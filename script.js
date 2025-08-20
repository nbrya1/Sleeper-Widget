/* Sleeper Live Score Widget (client-side, GitHub Pages)
   Usage: https://YOURUSERNAME.github.io/sleeper-widget/?league=LEAGUE_ID&roster=ROSTER_ID
   Optional: &refresh=15 (seconds), &theme=dark|light
*/

const q = new URLSearchParams(location.search);
const LEAGUE_ID = q.get("league");
const MY_ROSTER_ID = Number(q.get("roster"));
const REFRESH_SECS = Math.max(5, Number(q.get("refresh") || 15)); // 5s min
const THEME = (q.get("theme") || "dark").toLowerCase();

if (!LEAGUE_ID || !MY_ROSTER_ID) {
  document.body.innerHTML = `
    <main id="card" style="display:flex;align-items:center;justify-content:center;text-align:center;">
      <div>
        <h3>Missing settings</h3>
        <p>Add <code>?league=YOUR_LEAGUE_ID&roster=YOUR_ROSTER_ID</code> to the URL.</p>
      </div>
    </main>`;
  throw new Error("Missing league/roster query params");
}

// (Very light) theming support
if (THEME === "light") {
  const style = document.documentElement.style;
  style.setProperty("--bg", "#f5f7fb");
  style.setProperty("--card", "#ffffff");
  style.setProperty("--text", "#0b0f14");
  style.setProperty("--muted", "#50627a");
  style.setProperty("--pill", "#eef2f7");
  style.setProperty("--sep", "#c9d3e1");
}

const els = {
  leagueName: document.getElementById("leagueName"),
  statusDot: document.getElementById("statusDot"),
  clock: document.getElementById("clock"),
  meName: document.getElementById("meName"),
  oppName: document.getElementById("oppName"),
  meScore: document.getElementById("meScore"),
  oppScore: document.getElementById("oppScore"),
  record: document.getElementById("record"),
  updated: document.getElementById("updated"),
};

const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function getCurrentWeek() {
  const state = await fetchJSON("https://api.sleeper.app/v1/state/nfl");
  // If preseason/postseason, you may want to handle differently. We'll just use their week.
  return { week: state.week, season_type: state.season_type, season: state.season };
}

function nameFrom(roster, usersMap) {
  // Prefer custom team_name (if set), else owner's display_name
  const owner = usersMap.get(roster.owner_id);
  const teamName = roster.metadata?.team_name;
  return (teamName && teamName.trim().length) ? teamName : (owner?.display_name || `Roster ${roster.roster_id}`);
}

async function loadAndRender() {
  try {
    els.statusDot.style.background = "var(--dot)";

    const { week, season_type, season } = await getCurrentWeek();
    const [matchups, rosters, users] = await Promise.all([
      fetchJSON(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}`),
      fetchJSON(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`),
      fetchJSON(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`),
    ]);

    // Build helper maps
    const rosterById = new Map(rosters.map(r => [r.roster_id, r]));
    const usersMap = new Map(users.map(u => [u.user_id, u]));
    const myRoster = rosterById.get(MY_ROSTER_ID);

    // Find my matchup and opponent via matchup_id
    const myEntry = matchups.find(m => m.roster_id === MY_ROSTER_ID);
    const myMatchupId = myEntry?.matchup_id;
    const oppEntry = matchups.find(m => m.matchup_id === myMatchupId && m.roster_id !== MY_ROSTER_ID);

    const myScore = fmt(myEntry?.points || 0);
    const oppScore = fmt(oppEntry?.points || 0);

    const myName = myRoster ? nameFrom(myRoster, usersMap) : "Me";
    const oppRoster = oppEntry ? rosterById.get(oppEntry.roster_id) : null;
    const oppName = oppRoster ? nameFrom(oppRoster, usersMap) : "Opponent";

    // League/Week labels
    els.leagueName.textContent = `Week ${week}`;
    els.record.textContent = `${season_type.toUpperCase()} ${season} • Week ${week}`;
    els.updated.textContent = `Updated ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;

    // Names & Scores
    els.meName.textContent = myName;
    els.oppName.textContent = oppName;
    els.meScore.textContent = myScore;
    els.oppScore.textContent = oppScore;

    // Tick clock / next refresh
    let remain = REFRESH_SECS;
    els.clock.textContent = `⟳ ${remain}s`;
    clearInterval(window.__ticker);
    window.__ticker = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        clearInterval(window.__ticker);
        loadAndRender();
      } else {
        els.clock.textContent = `⟳ ${remain}s`;
      }
    }, 1000);
  } catch (e) {
    els.statusDot.style.background = "#f59e0b"; // amber = warning
    els.updated.textContent = "Error loading scores";
    console.error(e);
    // Try again later
    setTimeout(loadAndRender, REFRESH_SECS * 1000);
  }
}

// Start
loadAndRender();
