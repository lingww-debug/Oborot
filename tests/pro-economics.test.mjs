import test from "node:test";
import assert from "node:assert/strict";
import { dealMargin, sellerQuestions } from "../lib/pro-types.ts";

test("all real costs reduce expected margin, including risk reserve", () => {
  assert.equal(dealMargin({purchase:20000,resale:35000,repair:4000,logistics:1000,reserve:2000}),8000);
});
test("unprofitable offers remain visibly negative", () => {
  assert.equal(dealMargin({purchase:30000,resale:31000,repair:2000,logistics:500,reserve:1000}),-2500);
});
test("questions cover repair, locks and bargaining and include known defects", () => {
  const general = sellerQuestions({defects:""});
  assert.ok(general.some(q=>q.includes("ремонт платы")));
  assert.ok(general.some(q=>q.includes("выйти из аккаунта")));
  assert.ok(general.some(q=>q.includes("торг")));
  const specific = sellerQuestions({defects:"Не работает Face ID"});
  assert.equal(specific.length,general.length+1);
  assert.ok(specific.some(q=>q.includes("Не работает Face ID")));
});
