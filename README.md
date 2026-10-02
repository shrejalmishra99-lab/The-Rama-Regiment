# BedLink

**Live emergency bed matching for ambulances.** Find the nearest hospital with the right bed, see how fresh the data is, and let BedLink fail over to the next hospital automatically.

TechForge 2026 submission. Domain: Healthtech.

## 1. Project Overview

During an emergency, an ambulance crew with a critical patient needs a hospital that has the right bed (ICU, ventilator, oxygen, cardiac, burns) right now. Today crews phone hospitals one by one, and online bed counts can be hours old. A bed that is free now may also be taken before the ambulance arrives.

BedLink solves this with three connected parts:

1. **Bed update screen** for hospital staff: one tap per bed type, built for a cheap phone. Each admin sees only their own hospital.
2. **Dispatch screen** for the ambulance crew: takes the patient's needs and pickup location and ranks hospitals by bed match, estimated travel time, data freshness and current load. Every listing shows how many minutes old its data is.
3. **Confirm-and-hold flow**: the chosen hospital accepts or rejects within 2 minutes, the bed is held for the ambulance, and the next best hospital is offered automatically on rejection or timeout.

## 2. Key Features

- **"Is this data still true?" score:** badge 🟢 fresh (under 10 min), 🟡 old (10-30 min), 🔴 very old (over 30 min), and "about 2 beds likely free" instead of a fixed count.
- **Probabilistic availability:** confidence decays with the age of the update (about a 28-minute half-life), so a 35-minute-old count shows roughly 42% confidence.
- **Bed-at-arrival prediction:** considers current beds, ambulance ETA, beds already held for other ambulances and expected walk-ins. Flags high risk and suggests another hospital.
- **Best-match ranking:** not just the nearest hospital. The score combines predicted availability at arrival, ETA, bed match, freshness and load, with a breakdown of why a hospital was chosen.
- **Partial-match mode:** if no hospital has everything, it shows the best partial match labelled "missing: ventilator" and the nearest hospital that can stabilise the patient. The screen is never empty.
- **2-minute countdown and automatic failover:** timer on both screens, bed held on accept, next hospital called on reject or timeout, with a timeline ("Hospital A: no reply → Hospital B: accepted").
- **Hospital heads-up:** after accepting, the ER sees the patient condition, ambulance arrival time and live ambulance location on a map.
- **Role-based access:** hospital admins sign in and can only see and update their own hospital.
- **Live demo mode:** one button plays the full story from emergency to arrival.
- **Persistent data:** beds, requests and an update history are saved in SQLite.

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite (`bedlink.db`, created automatically) |
| Frontend | HTML, CSS, JavaScript (no build step) |
| Map | Leaflet with OpenStreetMap tiles |
| Road routes and place search | OSRM and Nominatim public servers |

## 4. Architecture / Workflow

```
 Hospital admin (phone)     Dispatcher (web)        Hospital ER (web)
   Bed update screen       Map + ranking + timer    Accept / Reject + heads-up
          \                       |                        /
           \______________________|_______________________/
                                  |  REST (JSON)
                       +----------v-----------+
                       |   FastAPI backend    |
                       |  - Bed service       |
                       |  - Matching engine   |  freshness, confidence,
                       |  - Hold state machine|  bed-at-arrival, ranking
                       |  - Auth (roles)      |
                       +----------+-----------+
                                  |
                          SQLite (bedlink.db)

  External (no keys): OpenStreetMap tiles, OSRM routes, Nominatim search
```

**Workflow:** the dispatcher enters the patient's needs and location → BedLink ranks hospitals → the best one is offered the request with a 2-minute timer → it accepts and the bed is held (or it rejects or times out and the next hospital is offered) → the ambulance is tracked toward the hospital while the ER prepares → arrival.

## 5. Dataset / API Information

- **Hospital data is simulated.** The prototype seeds 24 well-known Mumbai hospitals with approximate coordinates and random bed counts and update ages. No real hospital data is used.
- **External services (no API keys needed):** OpenStreetMap tiles for the map, OSRM for road routes, Nominatim for place search.
- **No patient names or IDs are stored.** Only a short condition note and the beds needed.

Main backend endpoints (interactive docs at `/docs`):

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/hospitals` | Hospitals with bed counts and data age |
| POST | `/api/rank` | Rank hospitals for given needs and location |
| POST | `/api/requests` | Create a request and offer the best hospital |
| POST | `/api/requests/{id}/respond` | Hospital accepts or rejects (that hospital's admin only) |
| POST | `/api/beds/{hospital_id}` | Update a bed count (that hospital's admin only) |
| POST | `/api/beds/{hospital_id}/confirm` | "No change, still accurate" |
| POST | `/api/login` | Hospital admin login |
| GET | `/api/log` | Bed update history |

## 6. Setup & Installation

Requires Python 3.10+ and an internet connection (for the map).

```bash
git clone <repo-url>
cd <repo-folder>
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000**.

**Demo logins**
- Dispatcher: click "Continue as dispatcher".
- Hospital admin: choose a hospital and enter its number as a 4-digit PIN, for example hospital 9 uses `0009`.

Then click **▶ RUN LIVE DEMO** on the dispatch screen to watch the full workflow.

To test on a phone on the same Wi-Fi, start with `--host 0.0.0.0` and open `http://<your-computer-ip>:8000`.

## 7. Screenshots / Demo Information

Screenshots are in the `docs/` folder.

| Screen | Image |
|---|---|
| Dispatch command center | `docs/dispatch.png` |
| Best match and ranking | `docs/ranking.png` |
| Hospital alert and heads-up | `docs/hospital.png` |
| Bed update (phone) | `docs/bed-update.png` |

Demo video: `<add link>`

## 8. Limitations & Future Scope

**Limitations (prototype)**
- Hospital locations are approximate and bed counts are demo data.
- ETA is a distance-based estimate, not traffic-aware. The drawn route follows real roads.
- Ambulance location is simulated, not live GPS from the crew's phone.
- Login uses a demo PIN. There are no push or SMS notifications yet.
- Screens refresh by polling, not WebSockets.

**Future scope**
- Live ambulance GPS from the crew's phone and traffic-aware ETA
- WebSockets plus push and SMS alerts for hospital offers
- Learn each hospital's walk-in and discharge patterns from the update history
- Integration with 108 ambulance dispatch and hospital information systems so beds update automatically
- Real authentication, audit logs, PostgreSQL and multi-city rollout

## 9. Team Members

| Name | Role |
|---|---|
| `<Shrejal Mishra>` | `<Team Leader>` |
| `<Vishal Pandey>` | `<Member>` |

Team name: `<The Rama Regiment>`

## Credits

Map data © OpenStreetMap contributors. Built with FastAPI and Leaflet.
