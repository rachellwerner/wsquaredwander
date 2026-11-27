# W²ander trip file format (`.w2ander.json`)

Import on the Trips page → **Import**. Export from a trip's **Edit** page.

```json
{
  "format": "w2ander-trip",
  "version": 1,
  "trip": {
    "title": "Ireland 2027",
    "startDate": "2027-04-17",
    "endDate": "2027-04-26"
  },
  "people": ["Rachel", "Brendan"],
  "bookings": [
    {
      "date": "2027-04-17",
      "type": "airfare",
      "title": "Flight to Dublin",
      "startTime": "17:45",
      "from": "IAH",
      "to": "DUB",
      "airline": "United",
      "flightNumber": "UA 1",
      "confirmed": true,
      "who": ["everyone"]
    },
    {
      "date": "2027-04-18",
      "type": "hotel",
      "title": "The Shelbourne",
      "address": "27 St Stephen's Green, Dublin",
      "checkIn": "2027-04-18",
      "checkOut": "2027-04-21"
    },
    {
      "date": "2027-04-19",
      "type": "activity",
      "title": "Guinness Storehouse",
      "startTime": "14:00",
      "category": "tour",
      "location": "St James's Gate, Dublin",
      "notes": "Book the Connoisseur tasting"
    },
    {
      "date": "2027-04-19",
      "type": "meal",
      "title": "Dinner at Chapter One",
      "startTime": "19:30",
      "category": "Dinner",
      "location": "Chapter One, 18-19 Parnell Square, Dublin",
      "guests": "6"
    }
  ],
  "votes": [
    {
      "question": "Day trip from Dublin?",
      "date": "2027-04-20",
      "options": [
        { "type": "activity", "title": "Glendalough & Wicklow", "location": "Glendalough" },
        { "type": "activity", "title": "Newgrange", "location": "Brú na Bóinne Visitor Centre" }
      ]
    }
  ]
}
```

## Rules

- **Dates** are `YYYY-MM-DD`. **Times** are 24-hour `HH:MM`. Every booking needs a
  `title` and should have a `date` (or `"day": 3` = third day of the trip).
- **type**: `airfare`, `transportation`, `hotel`, `meal`, or `activity`.
  Restaurant reservations are `meal` (`category`: Breakfast, Lunch, Dinner, Drinks…);
  tours, museums and tastings are `activity` (use `category` for detail).
- **confirmed**: `true` once it's booked; leave it out while it's still just a plan.
  (Entries with a `confirmation` number count as booked.)
- **who**: first names of people already on the People page, or `"everyone"`.
  Leave it out if it's everyone. Unknown names are skipped and listed as a warning.
- **Hotels**: put them on the check-in date and include `checkIn` / `checkOut`;
  the Today view shows the hotel on every night of the stay.
- **Calendar**: give entries a `startTime` and `endTime` (or a flight `duration`) so they
  fill the right slots on the Calendar tab; entries without a time show under “Anytime”.
- **Maps**: give activities and meals a `location` and hotels an `address` — that's what
  gets pinned on the map. Real place names work best.
- **votes** (optional): undecided choices. Each becomes a vote on the trip's
  Vote tab with 2–10 options (each option is a booking).
- Leave out anything you don't know. Never put passwords or card numbers in.

All booking fields: `date, day, type, title, startTime, endTime, who, confirmed, notes, url,
confirmation, cost, mode, from, to, duration, airline, flightNumber, seats,
terminal, provider, pickup, dropoff, hotelName, address, checkIn, checkOut,
roomType, guests, category, location, tickets, meetingPoint`.

Older files with `destination` or `coverEmoji` still import; those fields just aren’t shown anymore.
