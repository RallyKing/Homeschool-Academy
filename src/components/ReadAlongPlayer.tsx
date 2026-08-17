"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  Modal,
  Section,
} from "@/components/ui";
import { localIsoDate, localWeekStart } from "@/lib/dates";
import {
  farthestMatchedIndex,
  getSpeechRecognitionCtor,
  hasNewUnmatchedSpeech,
  isSkippableToken,
  LOOKAHEAD_WORDS,
  micAfterHelpFinished,
  micAfterMiss,
  micAfterRecognitionEnded,
  micAfterUserStop,
  speakText,
  speechRecognitionSupported,
  splitHighlightWords,
  stopSpeaking,
  ttsSupported,
  type MicIntent,
} from "@/lib/readAlongSpeech";

type WordEvent = {
  wordIndex: number;
  word: string;
  result: "correct" | "retry_ok" | "helped";
};

const FLUSH_EVERY = 8;
const FLUSH_MS = 300;
const MISS_GRACE_MS = 2500;
const FIRST_MISS_RESUME_MS = 500;

export function ReadAlongPlayer({
  sessionId,
  parentGuardrailContext,
  onExit,
  onFinished,
}: {
  sessionId: Id<"readAlongSessions">;
  parentGuardrailContext?: string;
  onExit: () => void;
  onFinished?: (summary: {
    title: string;
    durationMinutes: number;
    wordsCorrect: number;
    wordsMissed: number;
    pointsAwarded: number;
  }) => void;
}) {
  const data = useQuery(api.readAlong.getSession, { sessionId });
  const recordWordResults = useMutation(api.readAlong.recordWordResults);
  const enterPractice = useMutation(api.readAlong.enterPractice);
  const recordPracticeWord = useMutation(api.readAlong.recordPracticeWord);
  const finishSession = useMutation(api.readAlong.finishSession);
  const createLog = useMutation(api.logs.create);
  const explainVocab = useAction(api.ai.vocabExplain.explain);

  const [index, setIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [listening, setListening] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );
  const [localPoints, setLocalPoints] = useState(0);
  const [vocabOpen, setVocabOpen] = useState(false);
  const [vocabWord, setVocabWord] = useState("");
  const [vocabDef, setVocabDef] = useState("");
  const [vocabExample, setVocabExample] = useState("");
  const [vocabBusy, setVocabBusy] = useState(false);
  const [vocabHighlight, setVocabHighlight] = useState(-1);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [heard, setHeard] = useState("");

  const pendingRef = useRef<WordEvent[]>([]);
  const indexRef = useRef(0);
  const missesRef = useRef(0);
  const listeningRef = useRef(false);
  const micIntentRef = useRef<MicIntent>("off");
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    abort: () => void;
  } | null>(null);
  const listenGenRef = useRef(0);
  const transcriptAtLastMatchRef = useRef("");
  const resumeTimerRef = useRef<number | null>(null);
  const syncedRef = useRef(false);
  const vocabCache = useRef<Map<string, { definition: string; example: string }>>(
    new Map(),
  );
  const currentWordElRef = useRef<HTMLButtonElement | null>(null);
  const graceTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const wordsRef = useRef<string[]>([]);
  const processHeardRef = useRef<(transcript: string) => void>(() => {});

  const micOk = speechRecognitionSupported();
  const ttsOk = ttsSupported();
  const today = useMemo(() => localIsoDate(), []);
  const weekStart = useMemo(() => localWeekStart(), []);

  const session = data?.session;
  const story = data?.story;
  const words = useMemo(() => story?.words ?? [], [story?.words]);
  const helpWords = useMemo(
    () => session?.needsHelpWords ?? [],
    [session?.needsHelpWords],
  );
  const practiced = useMemo(
    () => session?.practicedWords ?? [],
    [session?.practicedWords],
  );

  wordsRef.current = words;

  const skipSkippable = useCallback(
    (from: number) => {
      let i = from;
      while (i < words.length && isSkippableToken(words[i]!)) {
        i += 1;
      }
      return i;
    },
    [words],
  );

  const effectiveIndex = skipSkippable(index);

  useEffect(() => {
    indexRef.current = effectiveIndex;
  }, [effectiveIndex]);
  useEffect(() => {
    missesRef.current = misses;
  }, [misses]);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  /* Hydrate resume position once when the session document arrives. */
  useEffect(() => {
    if (!session || syncedRef.current) return;
    syncedRef.current = true;
    queueMicrotask(() => {
      setIndex(session.currentWordIndex);
      setLocalPoints(session.pointsAwarded);
    });
  }, [session]);

  useEffect(() => {
    if (vocabOpen) return;
    currentWordElRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [effectiveIndex, vocabOpen]);

  const notify = useCallback(
    (text: string, tone: "info" | "error" | "success" = "info") => {
      setMessage(text);
      setMessageTone(tone);
    },
    [],
  );

  const clearGrace = useCallback(() => {
    if (graceTimerRef.current != null) {
      window.clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const flush = useCallback(
    async (currentWordIndex: number, extraHelp: string[] = []) => {
      const queued = pendingRef.current;
      if (queued.length === 0 && extraHelp.length === 0) {
        return { pointsGained: 0, needsHelpWords: helpWords };
      }
      const events = queued.slice(0, 40);
      pendingRef.current = queued.slice(40);
      const result = await recordWordResults({
        sessionId,
        events,
        currentWordIndex,
        needsHelpWords: extraHelp.length ? extraHelp : undefined,
        today,
        weekStart,
      });
      setLocalPoints(result.pointsAwarded);
      return result;
    },
    [helpWords, recordWordResults, sessionId, today, weekStart],
  );

  const scheduleFlush = useCallback(
    (currentWordIndex: number, extraHelp: string[] = []) => {
      const run = (wordIndex: number, help: string[]) => {
        if (flushTimerRef.current != null) {
          window.clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        void flush(wordIndex, help).catch((err) =>
          notify(
            err instanceof Error ? err.message : "Could not save progress",
            "error",
          ),
        );
      };

      if (extraHelp.length > 0 || pendingRef.current.length >= FLUSH_EVERY) {
        run(currentWordIndex, extraHelp);
        return;
      }
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        run(indexRef.current, []);
      }, FLUSH_MS);
    },
    [flush, notify],
  );

  const advanceThrough = useCallback(
    (
      throughIndex: number,
      lastResult: WordEvent["result"],
      helpedWord?: string,
    ) => {
      const start = indexRef.current;
      if (throughIndex < start) return;
      const events: WordEvent[] = [];
      for (let i = start; i <= throughIndex; i++) {
        const word = words[i];
        if (!word || isSkippableToken(word)) continue;
        events.push({
          wordIndex: i,
          word,
          result: i === throughIndex ? lastResult : "correct",
        });
      }
      const next = skipSkippable(throughIndex + 1);
      indexRef.current = next;
      setIndex(next);
      missesRef.current = 0;
      setMisses(0);
      setHeard("");
      clearGrace();
      if (next >= words.length) {
        micIntentRef.current = "off";
        listeningRef.current = false;
        listenGenRef.current += 1;
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setListening(false);
      }
      pendingRef.current = [...pendingRef.current, ...events];
      scheduleFlush(next, helpedWord ? [helpedWord] : []);
    },
    [clearGrace, scheduleFlush, skipSkippable, words],
  );

  const advance = useCallback(
    (result: WordEvent["result"], helpedWord?: string) => {
      const i = indexRef.current;
      const word = words[i];
      if (!word) return;
      advanceThrough(i, result, helpedWord);
    },
    [advanceThrough, words],
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setListenError(
        "Listening isn’t available in this browser. Tap Next after you read each word, or tap a word to hear it.",
      );
      return;
    }
    listenGenRef.current += 1;
    const gen = listenGenRef.current;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    clearResumeTimer();
    transcriptAtLastMatchRef.current = "";

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.onresult = (event) => {
      let combined = "";
      let interim = "";
      for (let r = 0; r < event.results.length; r++) {
        const row = event.results[r];
        const t = row?.[0]?.transcript ?? "";
        if (row.isFinal) combined += `${t} `;
        else interim = t;
      }
      const latest = `${combined}${interim}`.trim();
      setHeard(latest);
      processHeardRef.current(latest);
    };
    rec.onerror = (ev) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      if (ev.error === "not-allowed") {
        micIntentRef.current = "off";
        listeningRef.current = false;
        setListenError(
          "Microphone blocked. Allow the mic for this site, or tap Next after you read each word.",
        );
        setListening(false);
        return;
      }
      setListenError(`Mic: ${ev.error}`);
    };
    rec.onend = () => {
      if (gen !== listenGenRef.current) return;
      transcriptAtLastMatchRef.current = "";
      if (micAfterRecognitionEnded(micIntentRef.current) !== "restart") return;
      const retryStart = (attempt: number) => {
        if (gen !== listenGenRef.current) return;
        if (micAfterRecognitionEnded(micIntentRef.current) !== "restart") return;
        try {
          rec.start();
        } catch {
          if (attempt >= 2) {
            micIntentRef.current = "off";
            listeningRef.current = false;
            setListening(false);
            return;
          }
          window.setTimeout(() => retryStart(attempt + 1), attempt === 0 ? 0 : 50);
        }
      };
      retryStart(0);
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      micIntentRef.current = "live";
      listeningRef.current = true;
      setListening(true);
      setListenError(null);
    } catch {
      setListenError("Could not start the microphone. Try again, or tap Next.");
    }
  }, [clearResumeTimer]);

  const stopListening = useCallback(() => {
    const next = micAfterUserStop();
    micIntentRef.current = next.intent;
    listeningRef.current = false;
    listenGenRef.current += 1;
    setListening(false);
    clearGrace();
    clearResumeTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, [clearGrace, clearResumeTimer]);

  const resumeMicAfterHelp = useCallback(() => {
    if (indexRef.current >= wordsRef.current.length) return;
    if (micAfterHelpFinished(micIntentRef.current).command !== "start") return;
    startListening();
  }, [startListening]);

  const pauseMicForHelp = useCallback(() => {
    const next = micAfterMiss(micIntentRef.current);
    micIntentRef.current = next.intent;
    listeningRef.current = false;
    setListening(false);
    clearGrace();
    listenGenRef.current += 1;
    if (next.command === "stop") {
      recognitionRef.current?.stop();
    }
    recognitionRef.current = null;
  }, [clearGrace]);

  const handleMiss = useCallback(() => {
    const i = indexRef.current;
    const word = words[i];
    if (!word || isSkippableToken(word)) return;
    pauseMicForHelp();
    const nextMiss = missesRef.current + 1;
    if (nextMiss < 2) {
      missesRef.current = nextMiss;
      setMisses(nextMiss);
      notify(`Try "${normalizeDisplay(word)}" again.`, "info");
      clearResumeTimer();
      resumeTimerRef.current = window.setTimeout(() => {
        resumeTimerRef.current = null;
        resumeMicAfterHelp();
      }, FIRST_MISS_RESUME_MS);
      return;
    }
    const helped = normalizeDisplay(word);
    notify(`Listen: ${helped}. Keep going.`, "info");
    advance("helped", helped);
    if (ttsOk) {
      speakText(helped, {
        rate: 0.8,
        onEnd: () => resumeMicAfterHelp(),
      });
      return;
    }
    resumeMicAfterHelp();
  }, [
    advance,
    clearResumeTimer,
    notify,
    pauseMicForHelp,
    resumeMicAfterHelp,
    ttsOk,
    words,
  ]);

  const handleMatch = useCallback(() => {
    const result = missesRef.current > 0 ? "retry_ok" : "correct";
    advance(result);
    if (micIntentRef.current === "paused") {
      resumeMicAfterHelp();
    }
  }, [advance, resumeMicAfterHelp]);

  processHeardRef.current = (transcript: string) => {
    if (micIntentRef.current !== "live") return;
    const expectedWords = wordsRef.current;
    const i = indexRef.current;
    if (i >= expectedWords.length) return;
    const lookAhead = missesRef.current === 0 ? LOOKAHEAD_WORDS : 0;
    const matched = farthestMatchedIndex(
      transcript,
      expectedWords,
      i,
      lookAhead,
    );
    if (matched >= i) {
      transcriptAtLastMatchRef.current = transcript;
      const result = missesRef.current > 0 ? "retry_ok" : "correct";
      advanceThrough(matched, result);
      return;
    }
    if (!hasNewUnmatchedSpeech(transcript, transcriptAtLastMatchRef.current)) {
      return;
    }
    if (graceTimerRef.current != null) return;
    graceTimerRef.current = window.setTimeout(() => {
      graceTimerRef.current = null;
      if (micIntentRef.current !== "live") return;
      handleMiss();
    }, MISS_GRACE_MS);
  };

  useEffect(() => {
    return () => {
      listenGenRef.current += 1;
      micIntentRef.current = "off";
      recognitionRef.current?.abort();
      stopSpeaking();
      if (graceTimerRef.current != null) {
        window.clearTimeout(graceTimerRef.current);
      }
      if (resumeTimerRef.current != null) {
        window.clearTimeout(resumeTimerRef.current);
      }
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  async function openVocab(word: string) {
    const clean = normalizeDisplay(word);
    setVocabWord(clean);
    setVocabOpen(true);
    setVocabHighlight(-1);
    const cached = vocabCache.current.get(clean.toLowerCase());
    if (cached) {
      setVocabDef(cached.definition);
      setVocabExample(cached.example);
      return;
    }
    setVocabBusy(true);
    setVocabDef("");
    setVocabExample("");
    try {
      const result = await explainVocab({
        word: clean,
        ageBand: story?.ageBand,
        parentGuardrailContext,
      });
      vocabCache.current.set(clean.toLowerCase(), {
        definition: result.definition,
        example: result.example,
      });
      setVocabDef(result.definition);
      setVocabExample(result.example);
    } catch (err) {
      setVocabDef(err instanceof Error ? err.message : "Could not load definition.");
    } finally {
      setVocabBusy(false);
    }
  }

  const vocabSpokenText = [vocabDef, vocabExample].filter(Boolean).join(" ");
  const vocabDefWords = splitHighlightWords(vocabDef);
  const vocabExampleWords = splitHighlightWords(vocabExample);

  function speakVocab() {
    setVocabHighlight(0);
    speakText(vocabSpokenText, {
      rate: 0.85,
      onBoundaryWord: (i) => setVocabHighlight(i),
      onEnd: () => setVocabHighlight(-1),
    });
  }

  async function goToPracticeOrFinish() {
    const flushed = await flush(words.length);
    const needsHelp = flushed.needsHelpWords.length > 0;
    if (needsHelp) {
      await enterPractice({ sessionId });
      setPracticeIndex(0);
      notify("Practice the words that needed help, then finish.", "info");
      return;
    }
    await completeSession();
  }

  async function completeSession() {
    if (!session || !story || finishing) return;
    setFinishing(true);
    stopListening();
    try {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      await flush(Math.min(indexRef.current, words.length));
      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - session.startedAt);
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
      const logId = await createLog({
        studentId: session.studentId,
        entryType: "native_completion",
        durationMinutes,
        notes: `Read-along: ${story.title}`,
        today,
        weekStart,
      });
      const finished = await finishSession({
        sessionId,
        endedAt,
        logId,
      });
      notify("Story complete — time logged.", "success");
      onFinished?.({
        title: story.title,
        durationMinutes: finished.durationMinutes,
        wordsCorrect: finished.wordsCorrect,
        wordsMissed: finished.wordsMissed,
        pointsAwarded: finished.pointsAwarded,
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not finish", "error");
    } finally {
      setFinishing(false);
    }
  }

  async function onPracticeOk(word: string) {
    try {
      const result = await recordPracticeWord({
        sessionId,
        word,
        today,
        weekStart,
      });
      setLocalPoints((p) => p + result.pointsGained);
      const remaining = helpWords.filter(
        (w) =>
          !result.practicedWords.some(
            (p) => p.toLowerCase() === w.toLowerCase(),
          ),
      );
      if (remaining.length === 0) {
        await completeSession();
        return;
      }
      setPracticeIndex((i) => Math.min(i + 1, remaining.length - 1));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save practice", "error");
    }
  }

  if (data === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading story…</p>;
  }
  if (data === null || !session || !story) {
    return <EmptyState>This read-along session is gone.</EmptyState>;
  }

  const inPractice = session.status === "practice";
  const done = session.status === "completed";
  const current = words[effectiveIndex];
  const remainingPractice = helpWords.filter(
    (w) => !practiced.some((p) => p.toLowerCase() === w.toLowerCase()),
  );
  const practiceWord =
    remainingPractice[Math.min(practiceIndex, Math.max(0, remainingPractice.length - 1))];

  if (done) {
    const minutes = Math.max(
      1,
      Math.round((session.durationMs ?? 0) / 60000) || 1,
    );
    return (
      <Section
        title={story.title}
        description="This session is finished."
        action={
          <Button variant="ghost" size="sm" onClick={onExit}>
            Back
          </Button>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          {session.wordsCorrect} words correct · {session.wordsMissed} needed help ·{" "}
          {session.pointsAwarded} points · {minutes} min logged
        </p>
      </Section>
    );
  }

  const storyFinished = !inPractice && effectiveIndex >= words.length;

  return (
    <div className="read-along-session space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Read-along
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {story.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {index} / {words.length} words · {localPoints} points
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{localPoints} pts</Badge>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>

      <Message tone={messageTone}>{message}</Message>
      {listenError ? <Message tone="info">{listenError}</Message> : null}

      {!micOk ? (
        <Message tone="info">
          Listening isn’t available here (Safari and some browsers). Tap a word
          to hear it, then tap Next after you read it. Chrome or Edge can check
          your voice.
        </Message>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          We’ll keep the mic on while you’re reading well, and follow along even
          if you read ahead. It only pauses if a word is missed. Chrome and Edge
          use the browser’s speech service; we don’t store the audio.
        </p>
      )}

      {inPractice ? (
        <Section
          title="Practice missed words"
          description="Say or tap each word, then finish the session."
        >
          {remainingPractice.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Practice is done. Finish to log your time.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="font-display text-4xl font-semibold tracking-tight text-[var(--accent)]">
                {practiceWord}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {remainingPractice.length} left
              </p>
            </div>
          )}
        </Section>
      ) : (
        <>
          <div className="read-along-page rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
            <p className="read-along-text">
              {words.map((word, i) => {
                const currentWord = i === effectiveIndex;
                const helped = helpWords.some(
                  (h) =>
                    h.toLowerCase() === normalizeDisplay(word).toLowerCase() &&
                    i < index,
                );
                return (
                  <button
                    key={`${word}-${i}`}
                    type="button"
                    ref={currentWord ? currentWordElRef : undefined}
                    className={
                      currentWord
                        ? "read-along-word read-along-word-current"
                        : helped
                          ? "read-along-word read-along-word-helped"
                          : "read-along-word"
                    }
                    onClick={() => {
                      if (ttsOk) speakText(normalizeDisplay(word));
                      void openVocab(word);
                    }}
                  >
                    {word}
                  </button>
                );
              })}
            </p>
          </div>

          {misses > 0 && current ? (
            <Message tone="info">
              Pause — try “{normalizeDisplay(current)}” once more. A second miss
              plays the word so you can continue.
            </Message>
          ) : null}
        </>
      )}

      <nav className="read-along-dock" aria-label="Read-along controls">
        <div className="read-along-dock-inner">
          {inPractice ? (
            remainingPractice.length === 0 ? (
              <Button
                size="lg"
                className="read-along-dock-btn"
                onClick={() => void completeSession()}
                disabled={finishing}
              >
                {finishing ? "Saving…" : "Finish & log time"}
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="read-along-dock-btn"
                  onClick={() => practiceWord && speakText(practiceWord)}
                  variant="secondary"
                  disabled={!ttsOk}
                >
                  Hear it
                </Button>
                <Button
                  size="lg"
                  className="read-along-dock-btn"
                  onClick={() => practiceWord && void onPracticeOk(practiceWord)}
                >
                  I read it
                </Button>
              </>
            )
          ) : (
            <>
              {micOk ? (
                <Button
                  size="lg"
                  className="read-along-dock-btn"
                  onClick={() => (listening ? stopListening() : startListening())}
                  variant={listening ? "secondary" : "primary"}
                >
                  {listening ? "Stop mic" : "Start mic"}
                </Button>
              ) : null}
              <Button
                size="lg"
                className="read-along-dock-btn"
                variant="secondary"
                onClick={() => {
                  if (!current) return;
                  handleMatch();
                }}
                disabled={!current}
              >
                Next / I read it
              </Button>
              {current && ttsOk ? (
                <Button
                  size="lg"
                  className="read-along-dock-btn"
                  variant="ghost"
                  onClick={() => {
                    if (!current) return;
                    clearResumeTimer();
                    speakText(normalizeDisplay(current), {
                      onEnd: () => {
                        if (micIntentRef.current === "paused") {
                          resumeMicAfterHelp();
                        }
                      },
                    });
                  }}
                >
                  Hear this word
                </Button>
              ) : null}
              {storyFinished ? (
                <Button
                  size="lg"
                  className="read-along-dock-btn"
                  onClick={() => void goToPracticeOrFinish()}
                >
                  Continue
                </Button>
              ) : null}
            </>
          )}
          {heard && !inPractice ? (
            <p className="read-along-dock-heard">Heard: {heard}</p>
          ) : null}
        </div>
      </nav>

      <Modal
        open={vocabOpen}
        onClose={() => {
          stopSpeaking();
          setVocabOpen(false);
          setVocabHighlight(-1);
        }}
        title={vocabWord || "Word"}
        description="Age-fit meaning. Hear it with highlighting."
        size="md"
        className="flex max-h-[min(90dvh,42rem)] min-w-0 flex-col overflow-hidden"
        bodyClassName="max-h-[min(52vh,24rem)]"
        footerClassName="justify-center"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={speakVocab}
              disabled={!ttsOk || !vocabDef}
            >
              Read To Me
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                stopSpeaking();
                setVocabOpen(false);
                setVocabHighlight(-1);
              }}
            >
              Back to Story
            </Button>
          </>
        }
      >
        {vocabBusy ? (
          <p className="text-sm text-[var(--muted)]">Looking up…</p>
        ) : (
          <div className="read-along-vocab min-w-0 space-y-3">
            <p className="read-along-vocab-text text-base leading-relaxed">
              {vocabDefWords.map((w, i) => (
                <span
                  key={`def-${w}-${i}`}
                  className={
                    i === vocabHighlight
                      ? "read-along-word read-along-word-current"
                      : "read-along-word"
                  }
                >
                  {w}
                </span>
              ))}
            </p>
            {vocabExample ? (
              <p className="read-along-vocab-text text-sm text-[var(--muted)]">
                {vocabExampleWords.map((w, i) => {
                  const idx = vocabDefWords.length + i;
                  return (
                    <span
                      key={`ex-${w}-${i}`}
                      className={
                        idx === vocabHighlight
                          ? "read-along-word read-along-word-current"
                          : "read-along-word"
                      }
                    >
                      {w}
                    </span>
                  );
                })}
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

function normalizeDisplay(word: string): string {
  return word.replace(/^[^\w]+|[^\w]+$/g, "") || word;
}
