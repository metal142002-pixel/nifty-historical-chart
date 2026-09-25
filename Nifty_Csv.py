from flask import Flask, jsonify, send_from_directory, request
import pandas as pd
import os

# =========================================================
# SETTINGS
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "nifty50_candlestick_data.csv")
FRONTEND_FOLDER = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=FRONTEND_FOLDER)


# =========================================================
# LOAD CSV
# =========================================================

print("Loading NIFTY data...")

df = pd.read_csv(
    CSV_FILE,
    usecols=[
        "Date",
        "Time",
        "Open",
        "High",
        "Low",
        "Close"
    ]
)

print("CSV loaded.")

df["Datetime"] = pd.to_datetime(
    df["Date"].astype(str)
    + " "
    + df["Time"].astype(str),
    format="%d-%m-%Y %H:%M:%S",
    errors="coerce"
)

for col in ["Open", "High", "Low", "Close"]:
    df[col] = pd.to_numeric(
        df[col],
        errors="coerce"
    )

df = df.dropna(
    subset=[
        "Datetime",
        "Open",
        "High",
        "Low",
        "Close"
    ]
)

df = df.sort_values("Datetime")

df = df.set_index("Datetime")

df = df[
    [
        "Open",
        "High",
        "Low",
        "Close"
    ]
]

print(
    f"Total 1-minute candles: {len(df):,}"
)

print(
    f"From: {df.index.min()}"
)

print(
    f"To:   {df.index.max()}"
)


# =========================================================
# NIFTY MARKET SESSION
# =========================================================

MARKET_OPEN = "09:15"
MARKET_CLOSE = "15:30"


# =========================================================
# RESAMPLE FUNCTION
# =========================================================

def create_timeframe(data, minutes):

    if minutes == 1:
        return data

    rule = f"{minutes}min"

    result = data.resample(
        rule,
        origin="start_day",
        offset="15min",
        label="left",
        closed="left"
    ).agg(
        {
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last"
        }
    )

    result = result.dropna()

    return result


# =========================================================
# DAILY DATA
# =========================================================

def create_daily(data):

    result = data.resample(
        "1D"
    ).agg(
        {
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last"
        }
    )

    return result.dropna()


# =========================================================
# CACHE TIMEFRAMES
# =========================================================

print("Creating timeframe data...")

timeframe_data = {}

timeframe_data["1m"] = create_timeframe(df, 1)

timeframe_data["5m"] = create_timeframe(df, 5)

timeframe_data["15m"] = create_timeframe(df, 15)

timeframe_data["30m"] = create_timeframe(df, 30)

timeframe_data["1h"] = create_timeframe(df, 60)

timeframe_data["2h"] = create_timeframe(df, 120)

timeframe_data["4h"] = create_timeframe(df, 240)

timeframe_data["1d"] = create_daily(df)

print("All timeframes ready.")

for name, data in timeframe_data.items():

    print(
        f"{name}: {len(data):,} candles"
    )


# =========================================================
# FRONTEND
# =========================================================

@app.route("/")
def home():

    return send_from_directory(
        FRONTEND_FOLDER,
        "index.html"
    )


@app.route("/<path:filename>")
def frontend_files(filename):

    return send_from_directory(
        FRONTEND_FOLDER,
        filename
    )


# =========================================================
# API
# =========================================================

@app.route("/api/data")
def get_data():

    timeframe = request.args.get("timeframe", "5m")

    if timeframe not in timeframe_data:
        return jsonify({"error": "Invalid timeframe"}), 400

    data = timeframe_data[timeframe]

    start = request.args.get("start")
    end = request.args.get("end")

    # Filter date range
    if start:
        try:
            data = data[data.index >= pd.Timestamp(start)]
        except Exception:
            return jsonify({"error": "Invalid start date"}), 400

    if end:
        try:
            data = data[data.index <= pd.Timestamp(end)]
        except Exception:
            return jsonify({"error": "Invalid end date"}), 400

    # -----------------------------------------------------
    # LIMIT INITIAL DATA
    # -----------------------------------------------------

    MAX_CANDLES = 50000

    if len(data) > MAX_CANDLES:
        data = data.iloc[-MAX_CANDLES:]

    # -----------------------------------------------------
    # FAST CONVERSION
    # -----------------------------------------------------

    timestamps = (data.index.astype("int64") // 1_000_000_000).tolist()

    opens = data["Open"].tolist()
    highs = data["High"].tolist()
    lows = data["Low"].tolist()
    closes = data["Close"].tolist()

    candles = [
        {
            "time": int(timestamps[i]),
            "open": float(opens[i]),
            "high": float(highs[i]),
            "low": float(lows[i]),
            "close": float(closes[i])
        }
        for i in range(len(timestamps))
    ]

    return jsonify(candles)

    timeframe = request.args.get(
        "timeframe",
        "5m"
    )

    if timeframe not in timeframe_data:

        return jsonify(
            {
                "error":
                "Invalid timeframe"
            }
        ), 400


    data = timeframe_data[timeframe]


    # -----------------------------------------------------
    # OPTIONAL DATE FILTER
    # -----------------------------------------------------

    start = request.args.get("start")
    end = request.args.get("end")


    if start:

        try:

            data = data[
                data.index >=
                pd.Timestamp(start)
            ]

        except Exception:

            pass


    if end:

        try:

            data = data[
                data.index <=
                pd.Timestamp(end)
            ]

        except Exception:

            pass


    # -----------------------------------------------------
    # CONVERT TO LIGHTWEIGHT CHARTS FORMAT
    # -----------------------------------------------------

    candles = []

    for timestamp, row in data.iterrows():

        candles.append(
            {
                "time":
                    int(
                        timestamp.timestamp()
                    ),

                "open":
                    float(row["Open"]),

                "high":
                    float(row["High"]),

                "low":
                    float(row["Low"]),

                "close":
                    float(row["Close"])
            }
        )


    return jsonify(candles)


# =========================================================
# INFO API
# =========================================================

@app.route("/api/info")
def info():

    return jsonify(
        {
            "symbol": "NIFTY 50",

            "start":
                str(df.index.min()),

            "end":
                str(df.index.max()),

            "1m":
                len(timeframe_data["1m"]),

            "5m":
                len(timeframe_data["5m"]),

            "15m":
                len(timeframe_data["15m"]),

            "30m":
                len(timeframe_data["30m"]),

            "1h":
                len(timeframe_data["1h"]),

            "2h":
                len(timeframe_data["2h"]),

            "4h":
                len(timeframe_data["4h"]),

            "1d":
                len(timeframe_data["1d"])
        }
    )


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    print("")
    print("=" * 55)
    print("       NIFTY 50 HISTORICAL CHART")
    print("=" * 55)
    print("")
    print(
        "Open in browser:"
    )
    print(
        "http://127.0.0.1:5000"
    )
    print("")
    print("=" * 55)

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True
    )