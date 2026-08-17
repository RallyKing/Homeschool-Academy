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
  getSpeechRecognitionCtor,
  isSkippableToken,
  speakText,
  speechRecognitionSupported,
  stopSpeaking,
  transcriptMatchesWord,
  ttsSupported,
} from "@/lib/readAlongSpeech";

type WordEvent = {
  wordIndex: number;
  word: string;
  result: "correct" | "retry_ok" | "helped";
};

const FLUSH_EVERY = 8;

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
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(
    null,
  );
  const syncedRef = useRef(false);
  const vocabCache = useRef<Map<string, { definition: string; example: string }>>(
    new Map(),
  );

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

  const skipSkippable = useCallback((from: number) => {
    let i = from;
    while (i < words.length && isSkippableToken(words[i]!)) {
      i += 1;
    }
    return i;
  }, [words]);

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
    return () => {
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  const notify = useCallback(
    (text: string, tone: "info" | "error" | "success" = "info") => {
      setMessage(text);
      setMessageTone(tone);
    },
    [],
  );

  const flush = useCallback(
    async (currentWordIndex: number, extraHelp: string[] = []) => {
      const events = pendingRef.current;
      if (events.length === 0 && extraHelp.length === 0) {
        return { pointsGained: 0, needsHelpWords: helpWords };
      }
      pendingRef.current = [];
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

  const queueEvent = useCallback(
    (event: WordEvent, nextIndex: number, extraHelp: string[] = []) => {
      pendingRef.current = [...pendingRef.current, event];
      if (pendingRef.current.length >= FLUSH_EVERY) {
        void flush(nextIndex, extraHelp).catch((err) =>
          notify(err instanceof Error ? err.message : "Could not save progress", "error"),
        );
      } else if (extraHelp.length > 0) {
        void flush(nextIndex, extraHelp).catch((err) =>
          notify(err instanceof Error ? err.message : "Could not save progress", "error"),
        );
      }
    },
    [flush, notify],
  );

  const advance = useCallback(
    (result: WordEvent["result"], helpedWord?: string) => {
      const i = indexRef.current;
      const word = words[i];
      if (!word) return;
      const next = skipSkippable(i + 1);
      setIndex(next);
      setMisses(0);
      setHeard("");
      if (next >= words.length) {
        listeningRef.current = false;
        recognitionRef.current?.stop();
        setListening(false);
      }
      queueEvent(
        { wordIndex: i, word, result },
        next,
        helpedWord ? [helpedWord] : [],
      );
    },
    [queueEvent, skipSkippable, words],
  );

  const handleMiss = useCallback(() => {
    const i = indexRef.current;
    const word = words[i];
    if (!word || isSkippableToken(word)) return;
    const nextMiss = missesRef.current + 1;
    if (nextMiss < 2) {
      setMisses(nextMiss);
      notify(`Try "${normalizeDisplay(word)}" again.`, "info");
      return;
    }
    if (ttsOk) speakText(normalizeDisplay(word), { rate: 0.8 });
    notify(`Listen: ${normalizeDisplay(word)}. Keep going.`, "info");
    advance("helped", normalizeDisplay(word));
  }, [advance, notify, ttsOk, words]);

  const handleMatch = useCallback(() => {
    const result = missesRef.current > 0 ? "retry_ok" : "correct";
    advance(result);
  }, [advance]);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setListenError(
        "Listening isn’t available in this browser. Tap Next after you read each word, or tap a word to hear it.",
      );
      return;
    }
    recognitionRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.onresult = (event) => {
      let latest = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        const t = row?.[0]?.transcript ?? "";
        latest = t;
        if (row.isFinal) finalText = t;
      }
      setHeard(latest.trim());
      const expected = words[indexRef.current];
      if (!expected) return;
      if (transcriptMatchesWord(latest, expected)) {
        handleMatch();
        return;
      }
      if (finalText && !transcriptMatchesWord(finalText, expected)) {
        const said = finalText.trim();
        if (said.length > 0) handleMiss();
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") {
        setListenError(
          "Microphone blocked. Allow the mic for this site, or tap Next after you read each word.",
        );
        setListening(false);
        return;
      }
      if (ev.error === "no-speech") return;
      setListenError(`Mic: ${ev.error}`);
    };
    rec.onend = () => {
      if (listeningRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      }
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
      setListenError(null);
    } catch {
      setListenError("Could not start the microphone. Try again, or tap Next.");
    }
  }, [handleMatch, handleMiss, words]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
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

  function speakVocab() {
    const text = [vocabDef, vocabExample].filter(Boolean).join(" ");
    setVocabHighlight(0);
    speakText(text, {
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

  return (
    <div className="space-y-5">
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
          We’ll listen only while you read, to check the current word. Chrome
          and Edge use the browser’s speech service — we don’t store the audio.
        </p>
      )}

      {inPractice ? (
        <Section
          title="Practice missed words"
          description="Say or tap each word, then finish the session."
        >
          {remainingPractice.length === 0 ? (
            <Button onClick={() => void completeSession()} disabled={finishing}>
              {finishing ? "Saving…" : "Finish & log time"}
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="font-display text-4xl font-semibold tracking-tight text-[var(--accent)]">
                {practiceWord}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => practiceWord && speakText(practiceWord)}
                  variant="secondary"
                  disabled={!ttsOk}
                >
                  Hear it
                </Button>
                <Button
                  onClick={() => practiceWord && void onPracticeOk(practiceWord)}
                >
                  I read it
                </Button>
              </div>
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

          {heard ? (
            <p className="text-xs text-[var(--muted)]">Heard: {heard}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {micOk ? (
              <Button
                onClick={() => (listening ? stopListening() : startListening())}
                variant={listening ? "secondary" : "primary"}
              >
                {listening ? "Stop mic" : "Start mic"}
              </Button>
            ) : null}
            <Button
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
                variant="ghost"
                onClick={() => speakText(normalizeDisplay(current))}
              >
                Hear this word
              </Button>
            ) : null}
            {effectiveIndex >= words.length ? (
              <Button onClick={() => void goToPracticeOrFinish()}>
                Continue
              </Button>
            ) : null}
          </div>
        </>
      )}

      <Modal
        open={vocabOpen}
        onClose={() => {
          stopSpeaking();
          setVocabOpen(false);
        }}
        title={vocabWord || "Word"}
        description="Age-fit meaning. Hear it with highlighting."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={speakVocab}
              disabled={!ttsOk || !vocabDef}
            >
              Hear definition
            </Button>
            <Button variant="ghost" onClick={() => setVocabOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        {vocabBusy ? (
          <p className="text-sm text-[var(--muted)]">Looking up…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-base leading-relaxed">
              {vocabDef.split(/\s+/).map((w, i) => (
                <span
                  key={`${w}-${i}`}
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
              <p className="text-sm text-[var(--muted)]">{vocabExample}</p>
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
