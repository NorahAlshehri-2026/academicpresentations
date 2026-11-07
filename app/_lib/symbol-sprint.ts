/**
 * Symbol Sprint: the content of the note-taking symbols game (Coursebook
 * Unit 5). The symbols and abbreviations are the ones in the Unit 5 symbol
 * key; the notes and sentences come from the two Unit 5 talks.
 */

export const SYMBOLS: [string, string][] = [
  ["→", "leads to, causes"], ["←", "comes from, is caused by"], ["↑", "rises, increases"], ["↓", "falls, decreases"],
  ["=", "is, equals, means"], ["≠", "is not, is different from"], ["+", "and, plus, also"], [">", "more than"],
  ["<", "less than"], ["∴", "therefore, so"], ["~", "about, approximately"], ["★", "important"],
  ["?", "not sure, check later"], ["vs.", "compared with"],
];

export const ABBREVS: [string, string][] = [
  ["e.g.", "for example"], ["b/c", "because"], ["w/", "with"], ["w/o", "without"], ["pop.", "population"],
  ["govt", "government"], ["yrs", "years"], ["bn", "billion"], ["m", "million"], ["approx.", "approximately"],
  ["int'l", "international"], ["dev.", "development"], ["env.", "environment"], ["info", "information"],
];

/** two ways to write "approximately": never offered against each other */
export const SAME: Record<string, string> = { "~": "approx.", "approx.": "~" };

/** Round 2: a note with one symbol missing ({} marks the gap) */
export type GapItem = { note: string; a: string; o: string[]; why: string };
export const GAPS: GapItem[] = [
  { note: "added an egg to the cake mix {} sales ↑", a: "→", o: ["→", "←", "≠", "<"], why: "→ = leads to. Adding an egg led to more sales." },
  { note: "cake mix flopped {} people wanted to be part of the process", a: "b/c", o: ["b/c", "w/o", "∴", "="], why: "b/c = because. People wanted to help make the cake." },
  { note: "pay 63% more for things we make {} ready-made things", a: "vs.", o: ["vs.", "=", "←", "+"], why: "vs. = compared with." },
  { note: "world pop. still ↑ BUT growth rate {} since 1960s", a: "↓", o: ["↓", "↑", "=", "+"], why: "↓ = falls. The growth rate has been falling." },
  { note: "by mid-century: people 60+ {} children under 14", a: ">", o: [">", "<", "=", "≠"], why: "> = more than. There will be more people over 60." },
  { note: "if fertility stays the same {} pop. decline by 2100", a: "→", o: ["→", "←", "=", "↑"], why: "→ = leads to. The same fertility leads to decline." },
  { note: "Canada: 96% of record pop. growth {} immigration", a: "←", o: ["←", "→", "≠", "~"], why: "← = comes from. The growth came from immigration." },
  { note: "Ikea Effect {} we value things more when we make them", a: "=", o: ["=", "≠", "←", ">"], why: "= means. This is what the Ikea Effect means." },
  { note: "food links to most of the 17 UN goals {} food = a lever for change", a: "∴", o: ["∴", "←", "<", "?"], why: "∴ = therefore, so." },
  { note: "↓ food waste = 3rd most effective tool vs. climate change {}", a: "★", o: ["★", "?", "≠", "~"], why: "★ = important. Mark key points so you can find them later." },
  { note: "China's pop. could fall by {} 800 m by 2100", a: "~", o: ["~", "≠", ">", "∴"], why: "~ = about. The number is not exact." },
  { note: "Urban Agora: brings people {} researchers, cities and companies", a: "+", o: ["+", "≠", "<", "←"], why: "+ = and, also." },
];

/** Round 3: a sentence and three notes; the first note is the best one, the others say what is wrong */
export type ShrinkItem = { s: string; o: [string, string][] };
export const SHRINK: ShrinkItem[] = [
  { s: "Cities are home to 55% of the world's population, and this is expected to rise to 68% by 2050.",
    o: [["cities = 55% world pop. → 68% by 2050", ""], ["cities are home to 55% of the world's population and expected to rise to 68%", "Too long. You copied the sentence."], ["cities = 68% world pop. → 55% by 2050", "The numbers are the wrong way round."]] },
  { s: "In the 1950s, a cake mix that only needed water failed, because people wanted to be part of the process.",
    o: [["1950s cake mix (add water) flopped b/c people wanted to take part", ""], ["1950s cake mix flopped → people wanted to take part", "→ says the failure caused the wish. Use b/c (because)."], ["in the 1950s a cake mix that only needed water failed because people wanted to take part", "Too long. Cut the small words."]] },
  { s: "The growth rate of the world's population has been falling since the 1960s.",
    o: [["pop. growth rate ↓ since 1960s", ""], ["pop. growth rate ↑ since 1960s", "↑ means rising. The rate is falling: ↓."], ["the growth rate of the world's population has been falling since the 1960s", "Too long. Use pop. and ↓."]] },
  { s: "By the middle of the century, there will be more people over 60 than children under 14.",
    o: [["mid-century: 60+ > children under 14", ""], ["mid-century: 60+ < children under 14", "< means less than. There will be more older people: >."], ["by the middle of the century there will be more people over 60 than children", "Too long. Use a symbol for 'more than'."]] },
  { s: "Reducing food waste is the third most effective way to fight climate change, so it is an important point.",
    o: [["↓ food waste = 3rd best tool vs. climate change ★", ""], ["↑ food waste = 3rd best tool vs. climate change ★", "↑ means more food waste. The speaker means less: ↓."], ["reducing food waste is the third most effective way to fight climate change", "Too long, and the ★ for 'important' is missing."]] },
  { s: "South Korea spent $210 billion over 16 years, but fertility is still less than one child per woman.",
    o: [["S. Korea: $210 bn / 16 yrs BUT fertility still < 1 child/woman", ""], ["S. Korea: $210 m / 16 yrs BUT fertility still < 1 child/woman", "m = million. The speaker said billion: bn."], ["South Korea spent 210 billion dollars over 16 years but fertility is still less than one", "Too long. Use bn, yrs and <."]] },
  { s: "In Canada, 96% of the record population growth came from immigration.",
    o: [["Canada: 96% of pop. growth ← immigration", ""], ["Canada: 96% of pop. growth → immigration", "→ says growth caused immigration. Use ← (comes from)."], ["in Canada 96% of the record population growth came from immigration", "Too long. Use pop. and an arrow."]] },
  { s: "People are willing to pay 63% more for something they put effort into, compared with something pre-assembled.",
    o: [["pay 63% more for self-made vs. pre-assembled", ""], ["pay 36% more for self-made vs. pre-assembled", "Check the number: 63%, not 36%."], ["people are willing to pay 63% more for something they put effort into", "Too long, and the comparison is missing. Use vs."]] },
];

export type Round = { id: "match" | "gap" | "shrink"; name: string; n: number; time: number; rule: string; eg: string; card: string; cardEg: string };
export const ROUNDS: Round[] = [
  { id: "match", name: "Match it", n: 10, time: 10,
    rule: "A symbol or abbreviation appears. Choose what it means. Sometimes it is the other way round: choose the symbol for the meaning.",
    eg: "∴ → therefore, so", card: "Symbol or meaning? Pick the pair.", cardEg: "↑ = rises, increases" },
  { id: "gap", name: "Fill the gap", n: 6, time: 15,
    rule: "Here are notes on the two Unit 5 talks. One symbol is missing. Tap the one that makes the note correct.",
    eg: "added an egg ___ sales ↑", card: "Notes from the two talks. Add the missing symbol.", cardEg: "people 60+ ___ children" },
  { id: "shrink", name: "Shrink it", n: 6, time: 20,
    rule: "Read the sentence. Choose the best note: short, clear and correct. Watch out for long copies and wrong symbols.",
    eg: "pop. growth rate ↓ since 1960s", card: "Turn a long sentence into the best short note.", cardEg: "growth rate ↓ since 1960s" },
];
