import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cacheBustHref,
  clearCacheStorage,
  hardRefresh,
  unregisterServiceWorkers,
} from "./hardRefresh.ts";

describe("cacheBustHref", () => {
  it("adds a _fresh query without dropping existing params", () => {
    const href = cacheBustHref(
      "https://homeschool-academy.vercel.app/student/read-along?viewAs=abc",
      1700000000000,
    );
    assert.equal(
      href,
      "https://homeschool-academy.vercel.app/student/read-along?viewAs=abc&_fresh=1700000000000",
    );
  });

  it("replaces a previous _fresh stamp", () => {
    const href = cacheBustHref(
      "https://example.com/family?_fresh=1",
      99,
    );
    assert.equal(href, "https://example.com/family?_fresh=99");
  });
});

describe("unregisterServiceWorkers", () => {
  it("unregisters every registration", async () => {
    const calls: string[] = [];
    const count = await unregisterServiceWorkers({
      getRegistrations: async () => [
        {
          unregister: async () => {
            calls.push("a");
            return true;
          },
        },
        {
          unregister: async () => {
            calls.push("b");
            return true;
          },
        },
      ],
    });
    assert.equal(count, 2);
    assert.deepEqual(calls, ["a", "b"]);
  });

  it("is a no-op when service workers are missing", async () => {
    assert.equal(await unregisterServiceWorkers(undefined), 0);
  });
});

describe("clearCacheStorage", () => {
  it("deletes every named cache", async () => {
    const deleted: string[] = [];
    const count = await clearCacheStorage({
      keys: async () => ["ha-shell-v1", "other"],
      delete: async (key) => {
        deleted.push(key);
        return true;
      },
    });
    assert.equal(count, 2);
    assert.deepEqual(deleted, ["ha-shell-v1", "other"]);
  });
});

describe("hardRefresh", () => {
  it("unregisters workers, clears caches, then reloads with a cache-bust URL", async () => {
    const order: string[] = [];
    await hardRefresh({
      serviceWorker: {
        getRegistrations: async () => [
          {
            unregister: async () => {
              order.push("unregister");
              return true;
            },
          },
        ],
      },
      caches: {
        keys: async () => ["ha-shell-v1"],
        delete: async (key) => {
          order.push(`delete:${key}`);
          return true;
        },
      },
      href: "https://example.com/student",
      now: 42,
      replace: (url) => {
        order.push(`replace:${url}`);
      },
    });
    assert.deepEqual(order, [
      "unregister",
      "delete:ha-shell-v1",
      "replace:https://example.com/student?_fresh=42",
    ]);
  });
});
