from flask import Flask, jsonify, send_from_directory, request
import pandas as pd
import os


# =========================================================
# PATHS
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

CSV_FILE = os.path.join(
    BASE_DIR,
    "nifty50_candlestick_data.csv"
)

FRONTEND_FOLDER = os.path.join(
    BASE_DIR,
    "frontend"
)


# =========================================================
# FLASK APP
# =========================================================

app = Flask(
    __name__,
    static_folder=FRONTEND_FOLDER
)


# =========================================================
# LOAD CSV
# =========================================================

print("")
print("=" * 60)
print("Loading NIFTY data...")
print("=" * 60)

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


# =========================================================
# CREATE DATETIME
# =========================================================

df["Datetime"] = pd.to_datetime(
    df["Date"].astype(str)
    + " "
    + df["Time"].astype(str),
    format="%d-%m-%Y %H:%M:%S",
    errors="coerce"
)


# =========================================================
# CONVERT OHLC TO NUMERIC
# =========================================================

for col in [
    "Open",
    "High",
    "Low",
    "Close"
]:

    df[col] = pd.to_numeric(
        df[col],
        errors="coerce"
    )


# =========================================================
# REMOVE INVALID DATA
# =========================================================

df = df.dropna(
    subset=[
        "Datetime",
        "Open",
        "High",
        "Low",
        "Close"
    ]
)


# =========================================================
# SORT DATA
# =========================================================

df = df.sort_values(
    "Datetime"
)


# =========================================================
# SET DATETIME AS INDEX
# =========================================================

df = df.set_index(
    "Datetime"
)


# Keep only OHLC
df = df[
    [
        "Open",
        "High",
        "Low",
        "Close"
    ]
]


print(
    "Total 1-minute candles:",
    len(df)
)

print(
    "From:",
    df.index.min()
)

print(
    "To:",
    df.index.max()
)


# =========================================================
# TIMEFRAME FUNCTIONS
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

    result = result.dropna()

    return result


# =========================================================
# CREATE ALL TIMEFRAMES
# =========================================================

print("")
print("=" * 60)
print("Creating timeframe data...")
print("=" * 60)

timeframe_data = {}


timeframe_data["1m"] = create_timeframe(
    df,
    1
)

timeframe_data["5m"] = create_timeframe(
    df,
    5
)

timeframe_data["15m"] = create_timeframe(
    df,
    15
)

timeframe_data["30m"] = create_timeframe(
    df,
    30
)

timeframe_data["1h"] = create_timeframe(
    df,
    60
)

timeframe_data["2h"] = create_timeframe(
    df,
    120
)

timeframe_data["4h"] = create_timeframe(
    df,
    240
)

timeframe_data["1d"] = create_daily(
    df
)


print("")
print("All timeframes ready.")

print(
    "1m:",
    len(timeframe_data["1m"]),
    "candles"
)

print(
    "5m:",
    len(timeframe_data["5m"]),
    "candles"
)

print(
    "15m:",
    len(timeframe_data["15m"]),
    "candles"
)

print(
    "30m:",
    len(timeframe_data["30m"]),
    "candles"
)

print(
    "1h:",
    len(timeframe_data["1h"]),
    "candles"
)

print(
    "2h:",
    len(timeframe_data["2h"]),
    "candles"
)

print(
    "4h:",
    len(timeframe_data["4h"]),
    "candles"
)

print(
    "1d:",
    len(timeframe_data["1d"]),
    "candles"
)


# =========================================================
# FRONTEND ROUTES
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
# API INFO
# =========================================================

@app.route("/api/info")
def info():

    return jsonify(
        {
            "symbol": "NIFTY 50",

            "start": str(
                df.index.min()
            ),

            "end": str(
                df.index.max()
            ),

            "1m": len(
                timeframe_data["1m"]
            ),

            "5m": len(
                timeframe_data["5m"]
            ),

            "15m": len(
                timeframe_data["15m"]
            ),

            "30m": len(
                timeframe_data["30m"]
            ),

            "1h": len(
                timeframe_data["1h"]
            ),

            "2h": len(
                timeframe_data["2h"]
            ),

            "4h": len(
                timeframe_data["4h"]
            ),

            "1d": len(
                timeframe_data["1d"]
            )
        }
    )


# =========================================================
# API DATA
# =========================================================

@app.route("/api/data")
def get_data():

    timeframe = request.args.get(
        "timeframe",
        "5m"
    )


    # -----------------------------------------------------
    # Validate timeframe
    # -----------------------------------------------------

    if timeframe not in timeframe_data:

        return jsonify(
            {
                "error":
                "Invalid timeframe"
            }
        ), 400


    data = timeframe_data[
        timeframe
    ]


    # -----------------------------------------------------
    # Optional start date
    # -----------------------------------------------------

    start = request.args.get(
        "start"
    )


    if start:

        try:

            data = data.loc[
                data.index
                >= pd.Timestamp(start)
            ]

        except Exception:

            return jsonify(
                {
                    "error":
                    "Invalid start date"
                }
            ), 400


    # -----------------------------------------------------
    # Optional end date
    # -----------------------------------------------------

    end = request.args.get(
        "end"
    )


    if end:

        try:

            data = data.loc[
                data.index
                <= pd.Timestamp(end)
            ]

        except Exception:

            return jsonify(
                {
                    "error":
                    "Invalid end date"
                }
            ), 400


    # -----------------------------------------------------
    # Limit API response
    # -----------------------------------------------------

    MAX_CANDLES = 20000


    if len(data) > MAX_CANDLES:

        data = data.iloc[
            -MAX_CANDLES:
        ]


    # =====================================================
    # IMPORTANT:
    # CREATE CORRECT UNIX TIMESTAMPS
    # =====================================================

    timestamps = [
        int(
            pd.Timestamp(x).timestamp()
        )
        for x in data.index
    ]


    # -----------------------------------------------------
    # Convert OHLC to NumPy arrays
    # -----------------------------------------------------

    opens = data[
        "Open"
    ].to_numpy()

    highs = data[
        "High"
    ].to_numpy()

    lows = data[
        "Low"
    ].to_numpy()

    closes = data[
        "Close"
    ].to_numpy()


    # -----------------------------------------------------
    # Create response
    # -----------------------------------------------------

    candles = []


    for i in range(
        len(data)
    ):

        candles.append(
            {
                "time": int(
                    timestamps[i]
                ),

                # TEMPORARY DEBUG FIELD
                # We will remove this after
                # confirming timestamps.
                "debug_datetime":
                    str(data.index[i]),

                "open": float(
                    opens[i]
                ),

                "high": float(
                    highs[i]
                ),

                "low": float(
                    lows[i]
                ),

                "close": float(
                    closes[i]
                )
            }
        )


    return jsonify(
        candles
    )


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    print("")
    print("=" * 60)
    print("       NIFTY 50 HISTORICAL CHART")
    print("=" * 60)

    print("")
    print("Open in browser:")

    print(
        "http://127.0.0.1:5000"
    )

    print("")
    print("=" * 60)


    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True
    )