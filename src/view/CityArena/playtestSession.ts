// The city playtest compares Rome with a control map dressed as Rome. The two
// must render the same way, so once a tab opens the Mission Deck on the
// playtest address (?playtest=1), city buildings stay off for that tab's
// session; ordinary play always gets them.
const PLAYTEST_KEY = 'shinobiCityPlaytest';

export function rememberCityPlaytest(): void {
  try {
    sessionStorage.setItem(PLAYTEST_KEY, '1');
  } catch {
    // Storage off: the playtest address still lists the control map.
  }
}

export function isCityPlaytestSession(): boolean {
  try {
    return sessionStorage.getItem(PLAYTEST_KEY) === '1';
  } catch {
    return false;
  }
}
