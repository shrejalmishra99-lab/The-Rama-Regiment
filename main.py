"""BedLink backend (FastAPI). Run: uvicorn main:app --reload --port 8000
Demo uses an in-memory store; swap `HOSPITALS`/`REQUESTS` for Postgres+Redis later."""
import asyncio, json, math, random, secrets, sqlite3, time, uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from pathlib import Path

BED_TYPES = ["ICU", "Ventilator", "Oxygen", "Cardiac", "Burns", "Trauma", "NICU", "Stroke"]
WEIGHT = {"ICU": 3, "Ventilator": 3, "Cardiac": 2, "Burns": 2, "Oxygen": 1, "Trauma": 2, "NICU": 2, "Stroke": 2}
LAMBDA = 0.025           # half-life ~28 min
OFFER_SECONDS = 120
SPEED_KMH = 30           # stub for OSRM/Mapbox road ETA
now = time.time

def _h(i, name, lat, lng, beds, age, stab=True, load=0.5, walkin=0.03):
    return dict(id=i, name=name, lat=lat, lng=lng, stabilise=stab, load=load, walkin=walkin,
                beds={t: dict(count=beds.get(t, 0), updated=now() - age * 60) for t in BED_TYPES})

_rng = random.Random(7)  # (name, lat, lng, size 1-3) approximate demo coordinates
MUMBAI = [("KEM Hospital, Parel",19.0030,72.8420,3),("Tata Memorial Hospital, Parel",19.0045,72.8436,3),("Global Hospital, Parel",19.0000,72.8410,2),
("Lilavati Hospital, Bandra",19.0509,72.8294,3),("Hinduja Hospital, Mahim",19.0330,72.8397,3),("Holy Family Hospital, Bandra",19.0480,72.8330,1),
("Bhabha Hospital, Bandra",19.0560,72.8380,1),("Kokilaben Hospital, Andheri",19.1311,72.8258,3),("Seven Hills Hospital, Andheri E",19.1130,72.8740,2),
("Nanavati Max Hospital, Vile Parle",19.0990,72.8447,3),("Cooper Hospital, Vile Parle",19.1070,72.8330,2),("Sion Hospital (LTMG)",19.0390,72.8619,3),
("Wockhardt Hospital, Mumbai Central",18.9710,72.8200,2),("Nair Hospital, Mumbai Central",18.9740,72.8205,2),("JJ Hospital, Byculla",18.9632,72.8330,3),
("Jaslok Hospital, Peddar Road",18.9715,72.8105,3),("Breach Candy Hospital",18.9707,72.8040,2),("Saifee Hospital, Charni Road",18.9575,72.8190,2),
("Bombay Hospital, Marine Lines",18.9435,72.8270,3),("Rajawadi Hospital, Ghatkopar",19.0860,72.9000,2),("Fortis Hospital, Mulund",19.1630,72.9400,2),
("Hiranandani Hospital, Powai",19.1190,72.9060,2),("Shatabdi Hospital, Govandi",19.0600,72.9230,1),("Bhagwati Hospital, Borivali",19.2310,72.8500,2)]
SEED = []
for _i, (_n, _la, _ln, _sz) in enumerate(MUMBAI, 1):
    _b = dict(ICU=_rng.randint(0, 2*_sz), Ventilator=_rng.randint(0, 2*_sz-1), Oxygen=_rng.randint(1, 6*_sz), Cardiac=_rng.randint(0, _sz), Burns=_rng.randint(0, 2) if _sz > 1 else 0, Trauma=_rng.randint(0, _sz), NICU=_rng.randint(0, _sz) if _sz > 1 else 0, Stroke=_rng.randint(0, _sz))
    SEED.append(_h(_i, _n, _la, _ln, _b, _rng.choice([2, 4, 6, 9, 14, 22, 35, 50]), True, round(_rng.uniform(.3, .9), 2), .02 + .01*_sz))
HOSPITALS: dict[int, dict] = {}
REQUESTS: dict[str, dict] = {}

# ---------- SQLite persistence (file: bedlink.db, created on first run) ----------
DB_PATH = Path(__file__).parent / "bedlink.db"
def db():
    c = sqlite3.connect(DB_PATH); c.row_factory = sqlite3.Row; return c

def init_db(reseed=False):
    with db() as c:
        if reseed:
            for t in ("bed_update_log", "bed_inventory", "hospitals", "requests"): c.execute(f"DROP TABLE IF EXISTS {t}")
        c.executescript("""
        CREATE TABLE IF NOT EXISTS hospitals(id INTEGER PRIMARY KEY, name TEXT, lat REAL, lng REAL, stabilise INT, load REAL, walkin REAL);
        CREATE TABLE IF NOT EXISTS bed_inventory(hospital_id INT, bed_type TEXT, count INT, updated_at REAL, PRIMARY KEY(hospital_id, bed_type));
        CREATE TABLE IF NOT EXISTS bed_update_log(id INTEGER PRIMARY KEY AUTOINCREMENT, hospital_id INT, bed_type TEXT, old_count INT, new_count INT, ts REAL, source TEXT);
        CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, data TEXT);""")
        if c.execute("SELECT COUNT(*) FROM hospitals").fetchone()[0] < len(SEED) or c.execute("SELECT COUNT(DISTINCT bed_type) FROM bed_inventory").fetchone()[0] < len(BED_TYPES):  # first run / new seed list
            for t in ("hospitals", "bed_inventory"): c.execute(f"DELETE FROM {t}")
            for h in SEED:
                c.execute("INSERT INTO hospitals VALUES(?,?,?,?,?,?,?)", (h["id"], h["name"], h["lat"], h["lng"], int(h["stabilise"]), h["load"], h["walkin"]))
                for t, b in h["beds"].items(): c.execute("INSERT INTO bed_inventory VALUES(?,?,?,?)", (h["id"], t, b["count"], b["updated"]))

def load_state():
    HOSPITALS.clear(); REQUESTS.clear()
    with db() as c:
        for r in c.execute("SELECT * FROM hospitals"):
            HOSPITALS[r["id"]] = dict(id=r["id"], name=r["name"], lat=r["lat"], lng=r["lng"], stabilise=bool(r["stabilise"]),
                                      load=r["load"], walkin=r["walkin"], beds={t: dict(count=0, updated=now()) for t in BED_TYPES})
        for r in c.execute("SELECT * FROM bed_inventory"):
            HOSPITALS[r["hospital_id"]]["beds"][r["bed_type"]] = dict(count=r["count"], updated=r["updated_at"])
        for r in c.execute("SELECT id, data FROM requests"): REQUESTS[r["id"]] = json.loads(r["data"])

def save_bed(hid, t, old, source="admin"):
    b = HOSPITALS[hid]["beds"][t]
    with db() as c:
        c.execute("INSERT OR REPLACE INTO bed_inventory VALUES(?,?,?,?)", (hid, t, b["count"], b["updated"]))
        c.execute("INSERT INTO bed_update_log(hospital_id,bed_type,old_count,new_count,ts,source) VALUES(?,?,?,?,?,?)", (hid, t, old, b["count"], b["updated"], source))

def save_request(r):
    with db() as c: c.execute("INSERT OR REPLACE INTO requests VALUES(?,?)", (r["id"], json.dumps(r)))

init_db(); load_state()

def km(a, b, c, d):
    p = math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x)) * 1.3  # 1.3 = road factor

def eta_min(dist): return dist / SPEED_KMH * 60

def badge(age): return "green" if age < 10 else "yellow" if age <= 30 else "red"

def poisson_cdf(k, lam):  # P(X <= k)
    return sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k + 1)) if k >= 0 else 0.0

def holds_before(hid, bed, eta):
    return sum(1 for r in REQUESTS.values() if r["status"] == "HELD" and r["held_hid"] == hid
               and bed in r["needs"] and r["eta_at"] <= now() + eta * 60)

def evaluate(h, needs, lat, lng):
    dist = km(lat, lng, h["lat"], h["lng"]); eta = eta_min(dist)
    per, missing, p_all, conf_all, ages = {}, [], 1.0, 1.0, []
    for n in needs:
        b = h["beds"][n]; age = (now() - b["updated"]) / 60; conf = math.exp(-LAMBDA * age)
        eff = b["count"] - holds_before(h["id"], n, eta)
        # P(bed at arrival) = confidence*P(eff - arrivals >= 1) + (1-conf)*base rate
        p = conf * poisson_cdf(eff - 1, h["walkin"] * eta) + (1 - conf) * 0.35 if eff > 0 else (1 - conf) * 0.35
        if b["count"] <= 0: missing.append(n)
        per[n] = dict(reported=b["count"], age_min=round(age), badge=badge(age), confidence=round(conf * 100),
                      likely_free=max(0, round(b["count"] - age / 30)), low=max(0, b["count"] - math.ceil(age / 30)),
                      high=b["count"], at_arrival=round(p * 100), effective=eff)
        p_all *= p; conf_all = min(conf_all, conf); ages.append(age)
    tw = sum(WEIGHT[n] for n in needs) or 1
    match = sum(WEIGHT[n] for n in needs if n not in missing) / tw
    fresh = max(ages) if ages else 0
    score = .35 * p_all + .25 * max(0, 1 - eta / 60) + .20 * match + .10 * math.exp(-LAMBDA * fresh) + .10 * (1 - h["load"])
    risk = "HIGH" if p_all < .4 else "MEDIUM" if p_all < .7 else "LOW"
    return dict(id=h["id"], name=h["name"], lat=h["lat"], lng=h["lng"], dist_km=round(dist, 1), eta_min=round(eta),
                needs=per, missing=missing, full_match=not missing, match=round(match * 100),
                at_arrival=round(p_all * 100), risk=risk, oldest_min=round(fresh), badge=badge(fresh),
                load=round(h["load"] * 100), stabilise=h["stabilise"], score=round(score, 3),
                why=("Has " + ", ".join(n for n in needs if n not in missing) if len(missing) < len(needs) else "No requested beds")
                    + (f"; missing: {', '.join(missing)}" if missing else "") + f"; {round(eta)} min; {round(p_all*100)}% at arrival")

def rank(needs, lat, lng):
    res = sorted((evaluate(h, needs, lat, lng) for h in HOSPITALS.values()), key=lambda x: -x["score"])
    full = [r for r in res if r["full_match"]]
    stab = min((r for r in res if r["stabilise"]), key=lambda r: r["eta_min"], default=None)
    return dict(partial_mode=not full, results=res, nearest_stabilise=stab)

# ---------- offers / hold state machine ----------
def offer_next(r):
    r["idx"] += 1
    if r["idx"] >= len(r["order"]):
        r["status"] = "EXHAUSTED"; return
    hid = r["order"][r["idx"]]
    r["offers"].append(dict(hid=hid, name=HOSPITALS[hid]["name"], status="offered", offered_at=now(), expires_at=now() + OFFER_SECONDS))

async def watcher():
    while True:
        await asyncio.sleep(1)
        for r in REQUESTS.values():
            if r["status"] == "OFFERED" and r["offers"][-1]["expires_at"] <= now():
                r["offers"][-1]["status"] = "timeout"; offer_next(r); save_request(r)

@asynccontextmanager
async def lifespan(app):
    t = asyncio.create_task(watcher()); yield; t.cancel()

app = FastAPI(title="BedLink", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

TOKENS: dict[str, int] = {}
def auth(hid, authorization):
    if TOKENS.get((authorization or '').replace('Bearer ', '')) != hid: raise HTTPException(401, 'Not allowed for this hospital')

class BedUpdate(BaseModel): bed_type: str; delta: int = 0; count: int | None = None
class RankReq(BaseModel): needs: list[str]; lat: float; lng: float
class DispatchReq(RankReq): condition: str = ""
class Respond(BaseModel): accept: bool

@app.get("/api/hospitals")
def hospitals():
    return [dict(id=h["id"], name=h["name"], lat=h["lat"], lng=h["lng"], load=h["load"], beds={t: dict(count=b["count"], age_min=round((now() - b["updated"]) / 60))
            for t, b in h["beds"].items()}) for h in HOSPITALS.values()]

@app.post("/api/beds/{hid}")
def update_bed(hid: int, u: BedUpdate, authorization: str | None = Header(None)):
    auth(hid, authorization)
    b = HOSPITALS[hid]["beds"][u.bed_type]
    old = b["count"]
    b["count"] = max(0, u.count if u.count is not None else b["count"] + u.delta); b["updated"] = now()
    save_bed(hid, u.bed_type, old)
    return b

@app.post("/api/beds/{hid}/confirm")  # "No change, still accurate"
def confirm(hid: int, authorization: str | None = Header(None)):
    auth(hid, authorization)
    for t, b in HOSPITALS[hid]["beds"].items():
        b["updated"] = now(); save_bed(hid, t, b["count"], "confirm")
    return {"ok": True}

@app.post("/api/rank")
def rank_ep(q: RankReq): return rank(q.needs, q.lat, q.lng)

@app.post("/api/requests")
def create(q: DispatchReq):
    rk = rank(q.needs, q.lat, q.lng)
    order = [r["id"] for r in rk["results"] if r["match"] > 0] or [r["id"] for r in rk["results"]]
    rid = uuid.uuid4().hex[:8]
    r = dict(id=rid, needs=q.needs, condition=q.condition, lat=q.lat, lng=q.lng, order=order, idx=-1,
             offers=[], status="OFFERED", held_hid=None, eta_at=None, created=now())
    REQUESTS[rid] = r; offer_next(r); save_request(r)
    return view(r)

def view(r):
    out = {k: r[k] for k in ("id", "needs", "condition", "status", "offers", "held_hid", "eta_at", "lat", "lng")}
    out["server_time"] = now()
    if r["status"] == "HELD":  # simulated ambulance moves pickup -> hospital
        h = HOSPITALS[r["held_hid"]]; total = max(1, r["eta_at"] - r["held_at"])
        f = min(1, (now() - r["held_at"]) / total)
        out["ambulance"] = dict(lat=r["lat"] + (h["lat"] - r["lat"]) * f, lng=r["lng"] + (h["lng"] - r["lng"]) * f,
                                eta_min=max(0, round((r["eta_at"] - now()) / 60, 1)))
    return out

@app.get("/api/requests")
def list_req(): return [view(r) for r in sorted(REQUESTS.values(), key=lambda r: -r["created"])[:20]]

@app.get("/api/requests/{rid}")
def get_req(rid: str):
    if rid not in REQUESTS: raise HTTPException(404)
    return view(REQUESTS[rid])

@app.get("/api/hospitals/{hid}/offers")  # ER view polls this
def er_offers(hid: int, authorization: str | None = Header(None)):
    auth(hid, authorization)
    return [view(r) for r in REQUESTS.values()
            if (r["status"] == "OFFERED" and r["offers"][-1]["hid"] == hid) or (r["status"] == "HELD" and r["held_hid"] == hid)]

@app.post("/api/requests/{rid}/respond")
def respond(rid: str, body: Respond, authorization: str | None = Header(None)):
    r = REQUESTS[rid]
    auth(r['offers'][-1]['hid'], authorization)
    if r["status"] != "OFFERED": raise HTTPException(409, "No pending offer")
    o = r["offers"][-1]
    if body.accept:
        o["status"] = "accepted"; r["status"] = "HELD"; r["held_hid"] = o["hid"]; r["held_at"] = now()
        r["eta_at"] = now() + eta_min(km(r["lat"], r["lng"], HOSPITALS[o["hid"]]["lat"], HOSPITALS[o["hid"]]["lng"])) * 60
    else:
        o["status"] = "rejected"; offer_next(r)
    save_request(r)
    return view(r)


@app.post("/api/demo/respond/{rid}")  # demo helper: act as the hospital (accelerated 25 s trip)
def demo_respond(rid: str, accept: bool = True, timeout: bool = False):
    r = REQUESTS[rid]
    if timeout:
        r["offers"][-1]["status"] = "timeout"; offer_next(r); save_request(r); return view(r)
    t = secrets.token_hex(8); TOKENS[t] = r["offers"][-1]["hid"]
    out = respond(rid, Respond(accept=accept), "Bearer " + t)
    if accept and r["status"] == "HELD": r["eta_at"] = now() + 25; save_request(r)
    return view(r)

class Login(BaseModel): hospital_id: int; pin: str

@app.post("/api/login")  # demo PIN = hospital id as 4 digits, e.g. 0007
def login(q: Login):
    if q.hospital_id not in HOSPITALS or q.pin.strip().zfill(4) != f"{q.hospital_id:04d}": raise HTTPException(401, "Wrong PIN")
    t = secrets.token_hex(16); TOKENS[t] = q.hospital_id
    return dict(token=t, hospital_id=q.hospital_id, name=HOSPITALS[q.hospital_id]["name"])

@app.get("/api/log")  # bed update history (feeds the freshness/drift model later)
def bed_log(hid: int | None = None, limit: int = 50):
    q = "SELECT * FROM bed_update_log" + (" WHERE hospital_id=?" if hid else "") + " ORDER BY id DESC LIMIT ?"
    with db() as c: return [dict(r) for r in c.execute(q, ([hid] if hid else []) + [limit])]

@app.post("/api/reset")  # demo helper: wipe DB and reseed
def reset():
    init_db(reseed=True); load_state(); return {"ok": True}

# Serve the frontend from the same server (must stay last so /api routes win)
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")
