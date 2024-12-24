from flask import Flask, request
import json
import os

app = Flask(__name__)

class CupDB:
    def __init__(self, filename):
        self.filename = filename
        if not os.path.isfile(filename):
            with open(self.filename, 'w') as f:
                json.dump([], f)

    def save_record(self, record):
        data = self.read_all_records()
        data.append(record)
        with open(self.filename, 'w') as f:
            json.dump(data, f)

    def read_all_records(self):
        with open(self.filename, 'r') as f:
            return json.load(f)

db = CupDB('cup_data.json')

@app.route("/cups", methods=["GET"])
def retrieve_cup_data():
    all_cups = db.read_all_records()
    return all_cups, {"Access-Control-Allow-Origin": "*"}

@app.route("/cups", methods=["POST"])
def log_cup():
    new_record = {
        "Size": request.form["Size"],
        "Type": request.form["Type"],
        "CaffeineAmount": int(request.form["CaffeineAmount"]),
        "InitialTemp": float(request.form["InitialTemp"]),
        "CoolingTime": int(request.form["CoolingTime"]),
        "InitialReadTime": (request.form["InitialReadTime"]).replace(" at ", " "),
        "FinishedTime": (request.form["FinishedTime"]).replace(" at ", " ")
    }
    db.save_record(new_record)
    return "Cup logged", 201, {"Access-Control-Allow-Origin": "*"}

def run():
    app.run(port=8080)

if __name__ == "__main__":
    run()