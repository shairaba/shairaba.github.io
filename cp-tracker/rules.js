// 2027 VGC Championship Points rules. Edit here only; the app reads everything from this file.
// Table rows: [lowest placement covered, ... implied by previous row's max], so each row is [maxPlacement, kicker, cp].
// A placement earns CP only if entrants >= that row's kicker.
// verified:true = checked against championships.pokemon.com screenshots; false = third-party (victoryroad.pro), please confirm.

const T_MAJOR_COMMON = (cps) =>
  [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024].map((max, i) => [
    max,
    [0, 4, 8, 17, 33, 65, 129, 257, 513, 1025, 2049][i],
    cps[i],
  ]);

export const RULES = {
  season: "2027",
  // max = best possible CP for the group: bfl x top payout. For "major" it assumes the 3 Internationals (500 each)
  // plus 2 Regional/Special wins (350 each) = 2200, since only 3 Internationals exist per season.
  // bfl groups: results of types sharing a group compete for the same N counted slots
  groups: {
    league_challenge: { label: "League Challenge", bfl: 4, max: 60, verified: true },
    league_cup: { label: "League Cup", bfl: 4, max: 200, verified: true },
    global: { label: "Grand / Global Challenge", bfl: 4, max: 300, verified: true },
    major: { label: "Regional / Special / International", bfl: 5, max: 2200, verified: true },
  },
  types: {
    league_challenge: {
      label: "League Challenge", group: "league_challenge", verified: true,
      table: [[1, 0, 15], [2, 4, 12], [4, 8, 10], [8, 14, 8], [16, 25, 6], [32, 48, 4]],
    },
    league_cup: {
      label: "League Cup", group: "league_cup", verified: true,
      table: [[1, 0, 50], [2, 4, 40], [4, 8, 32], [8, 17, 25], [16, 48, 20], [32, 80, 16], [64, 128, 13]],
    },
    global: {
      label: "Grand / Global Challenge", group: "global", verified: true,
      table: [[1, 0, 75], [2, 8, 65], [4, 17, 54], [8, 33, 52], [16, 48, 25], [32, 65, 13], [64, 128, 11],
              [128, 257, 7], [256, 513, 5], [512, 1025, 4], [1024, 2049, 3]],
    },
    regional: {
      label: "Regional / Special Championship", group: "major", verified: true,
      table: T_MAJOR_COMMON([350, 325, 300, 280, 200, 160, 120, 80, 60, 45, 22]),
    },
    international: {
      label: "International Championship", group: "major", verified: true,
      table: T_MAJOR_COMMON([500, 480, 420, 380, 300, 240, 180, 140, 100, 85, 42]),
    },
  },
};

export function cpFor(typeKey, placement, entrants) {
  const t = RULES.types[typeKey];
  if (!t || !placement) return 0;
  const row = t.table.find(([max]) => placement <= max);
  if (!row) return 0;
  return entrants >= row[1] ? row[2] : 0;
}
