import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDoc } from "../../lib/admissions/content.ts";
import {
  A_G_RULES,
  calculateApplicationFee,
  calculateUcGpa,
  checkAg,
  estimateStatewideIndex,
  FEE_RULES,
  GPA_RULES,
  STATEWIDE_INDEX,
  TAG_RULES,
  type SemesterGrade,
} from "../../lib/admissions/rules.ts";

function body(slug: string) {
  const doc = getDoc(slug);
  assert.ok(doc, `missing document ${slug}`);
  return doc.body;
}

describe("rules match the knowledge base", () => {
  it("GPA minimums and honors caps", () => {
    const text = body(GPA_RULES.doc);
    assert.match(text, /California residents: 3\.0/);
    assert.match(text, /Nonresidents: 3\.4/);
    assert.match(text, /capped at 8 total/);
    assert.match(text, /No more than 4 honors points may come from 10th grade/);
  });

  it("A-G course counts and subject years", () => {
    const text = body(A_G_RULES.doc);
    assert.match(text, /15 yearlong college-preparatory courses/);
    assert.match(text, /At least 11 of the 15/);
    const headings: Record<string, RegExp> = {
      a: /## A - History \(2 years required\)/,
      b: /## B - English \(4 years required\)/,
      c: /## C - Mathematics \(3 years required, 4 years recommended\)/,
      d: /## D - Science \(2 years required, 3 years recommended\)/,
      e: /## E - Language Other Than English \(2 years required, 3 years recommended\)/,
      f: /## F - Visual and Performing Arts \(1 year required\)/,
      g: /## G - College-Preparatory Elective \(1 year required\)/,
    };
    for (const subject of A_G_RULES.subjects) assert.match(text, headings[subject.key], subject.key);
  });

  it("application fees", () => {
    const text = body(FEE_RULES.doc);
    assert.match(text, new RegExp(`\\$${FEE_RULES.domesticPerCampus} per UC campus`));
    assert.match(text, new RegExp(`\\$${FEE_RULES.internationalPerCampus} per campus for international`));
    assert.match(text, /up to four campuses/);
  });

  it("TAG campuses", () => {
    const text = body(TAG_RULES.doc);
    for (const campus of TAG_RULES.participating) assert.match(text, new RegExp(`- UC ${campus}`));
    assert.match(text, /UC Berkeley, UCLA, and UC San Diego do not participate in TAG/);
  });

  it("statewide index chart rows", () => {
    const text = body(STATEWIDE_INDEX.doc);
    for (const row of STATEWIDE_INDEX.chart) assert.ok(text.includes(`| ${row.label} | ${row.courses} |`), row.label);
  });
});

describe("calculateUcGpa", () => {
  const grade = (level: 10 | 11, letter: SemesterGrade["letter"], honors: SemesterGrade["honors"] = "none", apOrIb = false): SemesterGrade => ({ level, letter, honors, apOrIb });

  it("averages letter grades without rounding up", () => {
    const result = calculateUcGpa([grade(10, "A"), grade(10, "B"), grade(11, "B")]);
    assert.equal(result.unweighted, 3.33);
  });

  it("caps 10th-grade honors at 4 and total honors at 8", () => {
    const grades = [
      ...Array.from({ length: 6 }, () => grade(10, "A", "uc")),
      ...Array.from({ length: 6 }, () => grade(11, "A", "uc")),
    ];
    const result = calculateUcGpa(grades);
    assert.equal(result.resident.tenthGradeHonors, 4);
    assert.equal(result.resident.honorsPoints, 8);
    assert.equal(result.resident.gpa, truncate((48 + 8) / 12));
  });

  it("gives no honors point for D or F", () => {
    const result = calculateUcGpa([grade(11, "D", "uc"), grade(11, "A", "uc")]);
    assert.equal(result.resident.honorsPoints, 1);
  });

  it("weights only AP/IB courses for nonresidents", () => {
    const result = calculateUcGpa([grade(11, "A", "uc", true), grade(11, "A", "uc", false), grade(11, "A", "school")]);
    assert.equal(result.resident.honorsPoints, 2);
    assert.equal(result.nonresident.honorsPoints, 1);
  });

  it("handles no grades", () => {
    assert.equal(calculateUcGpa([]).resident.gpa, null);
  });
});

function truncate(value: number) {
  return Math.floor(value * 100) / 100;
}

describe("estimateStatewideIndex", () => {
  it("uses the row for the GPA range", () => {
    assert.equal(estimateStatewideIndex(4.02, 46).status, "meets");
    const short = estimateStatewideIndex(3.81, 60);
    assert.ok(short.status === "short");
    assert.equal(short.shortBy, 3);
  });

  it("reports GPAs below the chart", () => {
    assert.equal(estimateStatewideIndex(3.5, 80).status, "below-chart");
  });
});

describe("checkAg", () => {
  const full = { a: { beforeSenior: 2, senior: 0 }, b: { beforeSenior: 3, senior: 1 }, c: { beforeSenior: 3, senior: 0 }, d: { beforeSenior: 2, senior: 0 }, e: { beforeSenior: 2, senior: 0 }, f: { beforeSenior: 1, senior: 0 }, g: { beforeSenior: 1, senior: 0 } };

  it("passes a complete pattern", () => {
    const result = checkAg(full);
    assert.equal(result.totalYears, 15);
    assert.equal(result.allMet, true);
  });

  it("lets extra A-F years cover the elective", () => {
    const result = checkAg({ ...full, g: { beforeSenior: 0, senior: 0 }, c: { beforeSenior: 3, senior: 1 } });
    assert.equal(result.subjects.find((subject) => subject.key === "g")?.met, true);
  });

  it("requires 11 courses before senior year", () => {
    const result = checkAg({ ...full, b: { beforeSenior: 1, senior: 3 } });
    assert.equal(result.beforeSeniorMet, true);
    const late = checkAg({ ...full, b: { beforeSenior: 0, senior: 4 }, c: { beforeSenior: 1, senior: 2 } });
    assert.equal(late.beforeSeniorMet, false);
    assert.equal(late.allMet, false);
  });
});

describe("calculateApplicationFee", () => {
  it("charges per campus and waives up to four", () => {
    assert.equal(calculateApplicationFee(5, { international: false, waiverEligible: false }).total, 400);
    assert.equal(calculateApplicationFee(5, { international: false, waiverEligible: true }).total, 80);
    assert.equal(calculateApplicationFee(3, { international: false, waiverEligible: true }).total, 0);
  });

  it("never waives international fees", () => {
    assert.equal(calculateApplicationFee(2, { international: true, waiverEligible: true }).total, 190);
  });
});
