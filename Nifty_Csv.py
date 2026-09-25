from flask import Flask, jsonify, send_from_directory, request
import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "nifty50_candlestick_data.csv")
FRONTEND_FOLDER = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=FRONTEND_FOLDER)


# ============================================================
# LOAD CSV
# ============================================================

print("Loading NIFTY data...")

df = pd.read_csv(
    CSV_FILE,
    usecols=["Date", "Time", "Open", "High", "Low", "Close"]
)

df["Datetime"] = pd.to_datetime(
    df["Date"].astype(str) + " " + df["Time"].astype(str),
    format="%d-%m-%Y %H:%M:%S",
    errors="coerce"
)

for col in ["Open", "High", "Low", "Close"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna(
    subset=["Datetime", "Open", "High", "Low", "Close"]
)

df = df.sort_values("Datetime")

df = df.set_index("Datetime")

df = df[["Open", "High", "Low", "Close"]]

print("CSV loaded.")
print("Total 1-minute candles:", len(df))
print("From:", df.index.min())
print("To:", df.index.max())


# ============================================================
# TIMEFRAME FUNCTIONS
# ============================================================

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
    ).agg({
        "Open": "first",
        "High": "max",
        "Low": "min",
        "Close": "last"
    })

    return result.dropna()


def create_daily(data):

    result = data.resample("1D").agg({
        "Open": "first",
        "High": "max",
        "Low": "min",
        "Close": "last"
    })

    return result.dropna()


# ============================================================
# CREATE ALL TIMEFRAMES
# ============================================================

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
    print(f"{name}: {len(data)} candles")


# ============================================================
# API
# ============================================================

@app.route("/api/data")
def get_data():

    timeframe = request.args.get("timeframe", "1d")

    if timeframe not in timeframe_data:
        return jsonify({
            "error": "Invalid timeframe"
        }), 400

    data = timeframe_data[timeframe]

    # Optional date filtering
    start = request.args.get("start")
    end = request.args.get("end")

    if start:
        try:
            start_date = pd.to_datetime(start)
            data = data[data.index >= start_date]
        except Exception:
            pass

    if end:
        try:
            end_date = pd.to_datetime(end)
            data = data[data.index <= end_date]
        except Exception:
            pass

    # Convert datetime index to Unix seconds
    timestamps = (
        data.index.astype("int64") // 1_000_000_000
    ).tolist()

    # Convert OHLC data to Python lists
    opens = data["Open"].tolist()
    highs = data["High"].tolist()
    lows = data["Low"].tolist()
    closes = data["Close"].tolist()

    # Build response efficiently
    result = [
        {
            "time": int(timestamps[i]),
            "open": float(opens[i]),
            "high": float(highs[i]),
            "low": float(lows[i]),
            "close": float(closes[i])
        }
        for i in range(len(data))
    ]

    return jsonify(result)


# ============================================================
# FRONTEND
# ============================================================

@app.route("/")
def index():
    return send_from_directory(
        FRONTEND_FOLDER,
        "index.html"
    )


@app.route("/<path:path>")
def frontend_files(path):
    return send_from_directory(
        FRONTEND_FOLDER,
        path
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )