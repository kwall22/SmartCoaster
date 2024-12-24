var serviceId        = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
var characteristicId = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

var myCharacteristic = null;
var dec = new TextDecoder();
var enc = new TextEncoder();


document.querySelector("#connect-button").onclick = function () {
    navigator.bluetooth.requestDevice({
        filters: [{ services: [serviceId] }]
    }).then(device => {
        return device.gatt.connect();
    }).then(server => {
        return server.getPrimaryService(serviceId);
    }).then(service => {
        return service.getCharacteristic(characteristicId);
    }).then(characteristic => {
        myCharacteristic = characteristic;
        console.log("Connected to BLE device.");
        myCharacteristic.readValue().then(value => {
            let tempData = dec.decode(value);
            console.log("initial:", tempData);
        }).catch(error => {
            console.error("initial read failed:", error);
        });
        startPolling();
    }).catch(error => {
        console.error("Connection failed:", error);
    });
};

var updateIntervalSeconds = 10;
document.getElementById('set-interval-button').addEventListener('click', function () {
    var input = document.getElementById('interval-input').value;

    if (input && !isNaN(input) && Number(input) > 0) {
        updateIntervalSeconds = Number(input);
        localStorage.setItem('updateIntervalSeconds', updateIntervalSeconds);
        console.log(`update interval set to ${updateIntervalSeconds} seconds`);
    } else {
        console.log("error setting new interval");
    }
});
var lastUpdateTime = null;
var temperatureBuffer = [];
const hottestTempInput = document.getElementById('hottest-temp-input');
const coldestTempInput = document.getElementById('coldest-temp-input');

var newCup = true;
var currentLiquidTemp = 0;
function startPolling() {
    if (!myCharacteristic) {
        console.error("Characteristic failed");
        return;
    }
    intervalId = setInterval(() => {
        myCharacteristic.readValue()
        .then(value => {
            let tempData = dec.decode(value);
            //console.log("temp:", tempData);
            if (!tempData.includes("Hottest")) {
                const cupTemperature = parseFloat(tempData);
                if (!isNaN(cupTemperature)) {
                    if (cupTemperature >= 130){
                        var difference = 0.5129 * cupTemperature - 62.14;
                        var liquidTemp = cupTemperature + difference;
                        currentLiquidTemp = liquidTemp;
                        if(newCup){
                            var startTime = new Date();
                            startCupRecord(startTime, liquidTemp);
                            newCup = false;
                        }
                    }
                    else if(cupTemperature < 130 && cupTemperature >= 127.6 ){
                        var difference = 0.5129 * cupTemperature - 58.14;
                        var liquidTemp = cupTemperature + difference;
                        currentLiquidTemp = liquidTemp;
                        if(newCup){
                            var startTime = new Date();
                            startCupRecord(startTime, liquidTemp);
                            newCup = false;
                        }
                    }
                    else if(cupTemperature < 127.6 && cupTemperature >= 115.6){
                        var difference = 0.51 * cupTemperature - 58.14;
                        var liquidTemp = cupTemperature + difference;
                        currentLiquidTemp = liquidTemp;
                        if (cupTemperature >= hottestTempInput.value){
                            if(newCup){
                                var startTime = new Date();
                                startCupRecord(startTime, liquidTemp);
                                newCup = false;
                            }
                        }
                    }
                    else if(cupTemperature < 115.6 && cupTemperature >= 108){
                        var difference = 0.51 * cupTemperature - 56.14;
                        var liquidTemp = cupTemperature + difference;
                        currentLiquidTemp = liquidTemp;
                    }
                    else{
                        var liquidTemp = cupTemperature;
                        currentLiquidTemp = liquidTemp;
                    }
                    document.querySelector("#current-temperature").innerText = `${liquidTemp.toFixed(2)}\u2109`;
                } else {
                    console.error("bad temp format in tempData");
                    document.querySelector("#current-temperature").innerText = "invalid temp";
                }
                //console.log("liquid temp: ", liquidTemp);
            }
            const now = Date.now();
            if (!lastUpdateTime) {
                lastUpdateTime = now;
            }
            if(currentLiquidTemp >= 0){
                temperatureBuffer.push(currentLiquidTemp);
            }

            if ((now - lastUpdateTime) >= updateIntervalSeconds * 1000) {
                var avgTemperature = computeAverageTemperature();
                if (avgTemperature !== null) {
                    var formattedTime = new Date(lastUpdateTime).toLocaleTimeString();
                    addDataToChart(formattedTime, avgTemperature);
                }
                lastUpdateTime = now;
                temperatureBuffer = [];
            }
        }).catch(error => {
            console.error("read failed:", error);
        });
    }, 1000);
};

function submitThresholds(){
    var hottestTemp = document.getElementById('hottest-temp-input').value.trim();
    var coldestTemp = document.getElementById('coldest-temp-input').value.trim();
    
    localStorage.setItem('hottestTemp', hottestTemp);
    localStorage.setItem('coldestTemp', coldestTemp);
    var message = `Hottest:${hottestTemp};Coldest:${coldestTemp}`;
    console.log("Sending message:", message);
    if (!myCharacteristic) {
        return;
    }
    myCharacteristic.writeValue(enc.encode(message));
};


var drinkOption = document.getElementById("drinkType");
var currentSelectedDrinkType = "";
var sizeOption = document.getElementById("drinkSize");
var currentSelectedDrinkSize = "";

window.onload = function() {
    var savedHottestTemp = localStorage.getItem('hottestTemp');
    var savedColdestTemp = localStorage.getItem('coldestTemp');

    if (savedHottestTemp) {
        hottestTempInput.value = savedHottestTemp;
    } else {
        hottestTempInput.value = 160;
    }

    if (savedColdestTemp) {
        coldestTempInput.value = savedColdestTemp;
    } else {
        coldestTempInput.value = 130;
    }

    var intervalInput = document.getElementById('interval-input');
    var savedUpdateInterval = localStorage.getItem('updateIntervalSeconds');
    if (savedUpdateInterval){
        intervalInput.value = savedUpdateInterval;
        updateIntervalSeconds = savedUpdateInterval;
    } else {
        intervalInput.placeholder = updateIntervalSeconds; //default 10 seconds, line 33
    }

    currentSelectedDrinkSize = localStorage.getItem('currentSelectedDrinkSize');
    currentSelectedDrinkType = localStorage.getItem('currentSelectedDrinkType');
   
    var drinkTypeDropdown = document.getElementById("drinkType");
    var drinkSizeDropdown = document.getElementById("drinkSize");
    drinkTypeDropdown.value = currentSelectedDrinkType;
    drinkSizeDropdown.value = currentSelectedDrinkSize;

};

const ctx = document.getElementById('temperature-chart').getContext('2d');
const temperatureData = {
    labels: [],
    datasets: [{
        label: 'Temperature',
        data: [],
        borderColor: 'rgba(39, 39, 103, 1)',
        backgroundColor: 'rgba(149, 119, 185, 0.8)',
        borderWidth: 2,
        tension: 0.4,
    }]
};

const temperatureChart = new Chart(ctx, {
    type: 'line',
    data: temperatureData,
    options: {
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time',
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Temperature',
                },
                min: 70,
                max: 150,
                ticks: {
                    stepSize: 4,
                }
            }
        },
        responsive: false,
        maintainAspectRatio: false,
    }
});

function computeAverageTemperature() {
    if (temperatureBuffer.length === 0) return null;
    var numericBuffer = temperatureBuffer.map(temp => parseFloat(temp));
    if (numericBuffer.some(isNaN)) {
        console.error("Buffer contains invalid values:", numericBuffer);
        return null;
    }
    var sum = numericBuffer.reduce((a, b) => a + b, 0);
    var average = sum / numericBuffer.length;
    return average;
};

function addDataToChart(timeLabel, temperature) {
    temperatureData.labels.push(timeLabel);
    temperatureData.datasets[0].data.push(temperature);
    if (temperatureData.labels.length > 20) {
        temperatureData.labels.shift();
        temperatureData.datasets[0].data.shift();
    }
    temperatureChart.update();
};

const drinkData = {
    coffee: {
        "8oz": 95,
        "12oz": 120,
        "16oz": 175,
    },
    latte: {
        "8oz": 63,
        "12oz": 95,
        "16oz": 120,
    },
    greenTea: {
        "8oz": 35,
        "12oz": 50,
        "16oz": 70,
    },
    matcha: {
        "8oz": 70,
        "12oz": 95,
        "16oz": 130,
    }
};

function fillDropdowns(drinkData) {
    var drinkTypeDropdown = document.getElementById("drinkType");
    drinkTypeDropdown.innerHTML = "";
    for (var drinkType in drinkData) {
        var option = document.createElement("option");
        option.value = drinkType;
        option.textContent = drinkType.charAt(0).toUpperCase() + drinkType.slice(1);
        drinkTypeDropdown.appendChild(option);
    }
    currentSelectedDrinkType = localStorage.getItem('currentSelectedDrinkType');
    fillDrinkSizes(drinkData, currentSelectedDrinkType);

    drinkTypeDropdown.addEventListener("change", (event) => {
        var selectedDrinkType = event.target.value;
        currentSelectedDrinkType = selectedDrinkType;
        localStorage.setItem("currentSelectedDrinkType", currentSelectedDrinkType);
        fillDrinkSizes(drinkData, selectedDrinkType);
    });
};
function fillDrinkSizes(drinkData, drinkType) {
    var drinkSizeDropdown = document.getElementById("drinkSize");
    drinkSizeDropdown.innerHTML = "";
    var sizes = drinkData[drinkType];
    for (var size in sizes) {
        var option = document.createElement("option");
        option.value = size;
        option.textContent = size;
        drinkSizeDropdown.appendChild(option);
    }
    //var sizeOption = document.getElementById("drinkSize");
    //var currentSizeOption = sizeOption.options[sizeOption.selectedIndex].value;
    currentSelectedDrinkSize = localStorage.getItem(currentSelectedDrinkSize);
    //currentSelectedDrinkSize = localStorage.setItem('currentSelectedDrinkSize', currentSizeOption);
    drinkSizeDropdown.addEventListener("change", (event) => {
        var selectedDrinkSize = event.target.value;
        currentSelectedDrinkSize = selectedDrinkSize;
        localStorage.setItem("currentSelectedDrinkSize", currentSelectedDrinkSize);
        console.log("setting size:", currentSelectedDrinkSize);
    });
};
fillDropdowns(drinkData);

function getCurrentTemperature() {
    if (currentLiquidTemp != 0){
        return currentLiquidTemp;
    }
};

var coolingStartTime = null;
var finishedStartTime = null;
var coolingTimer = null;
var finishedTimer = null;
var comfortTempRange = {min: coldestTempInput, max: hottestTempInput};
var roomTempRange = {min: 65, max: 80};
function startCupRecord(startTime, initialDrinkTemp) {
    var caffeineAmount = parseInt(drinkData[currentSelectedDrinkType][currentSelectedDrinkSize]);
    var size = currentSelectedDrinkSize;
    var type = currentSelectedDrinkType.charAt(0).toUpperCase() + currentSelectedDrinkType.slice(1);
    initialTemp = parseFloat(initialDrinkTemp.toFixed(2));
    initialTime = startTime.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    console.log("temperature spike detected");

    coolingStartTime = new Date();
    coolingTimer = setInterval(() => {
        let currentTemp = getCurrentTemperature();
        console.log("checking current temp in cooling timer");
        //console.log((currentTemp <= parseInt(hottestTempInput.value) && currentTemp >= parseInt(coldestTempInput.value)));
        if (currentTemp <= parseInt(hottestTempInput.value) && currentTemp >= parseInt(coldestTempInput.value)) {
            clearInterval(coolingTimer);
            console.log("stopping cooling time");
            var coolingTime = Math.round((new Date() - coolingStartTime) / 1000);
            console.log(`Cooling time: ${coolingTime} seconds`);

            finishedStartTime = new Date();
            finishedTimer = setInterval(() => {
                let currentTemp = getCurrentTemperature();
                if (currentTemp >= 65 && currentTemp <= 80) {

                    console.log("in room temperature");
                    var roomTempDuration = (new Date() - finishedStartTime) / 1000;
                    if (roomTempDuration >= 20 ){ //putting 300 seconds here = 5 minutes left at room temperature
                        clearInterval(finishedTimer);
                        console.log(`At room temperature for ${roomTempDuration} seconds, cup finished`);

                        logCupRecord({
                            Size: size,
                            Type: type,
                            CaffeineAmount: caffeineAmount,
                            InitialTemp: initialTemp,
                            CoolingTime: parseInt(coolingTime),
                            InitialReadTime: initialTime,
                            FinishedTime: new Date().toLocaleString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                            }),
                        });
                    }
                }
            }, 1000);
        }
    }, 1000);
}


function logCupRecord(cupRecord) {
    var formData = new FormData();
    for (var key in cupRecord) {
        formData.append(key, cupRecord[key]);
    }
    fetch("http://localhost:8080/cups", {
        method: "POST",
        body: formData,
    })
    .then(response => {
        if (response.ok) {
            console.log("cup record logged successfully!");
            newCup = true;
            loadCupMetrics();
        } else {
            console.error("error logging cup record");
        }
    });
};

function loadCupMetrics() {
    fetch("http://localhost:8080/cups")
    .then(response => response.json())
    .then(data => {
        console.log("cup data received:", data);
        updateCaffeineChart(data);
        updateCupChart(data);
    })
    .catch(error => console.error("error loading cup data:", error));
}

function updateCaffeineChart(cups) {
    const today = new Date('2024-12-10T00:00:00');
    //const today = new Date();
    var last7Days = [];
    for (var i = 6; i >= 0; i--) {
        var date = new Date(today);
        date.setDate(today.getDate() - i);
        last7Days.push(date);
    }
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const caffeineData = new Array(7).fill(0);

    cups.forEach(cup => {
        const cupDate = new Date(cup.InitialReadTime);
        const dayOfWeek = cupDate.getDay();
        const weekdayIndex = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        caffeineData[weekdayIndex] += cup.CaffeineAmount;
    });

    caffeineChart.data.labels = weekdays;
    caffeineChart.data.datasets[0].data = caffeineData;
    caffeineChart.update();
}

let caffeineChart;

function initializeCaffeineChart() {
    const ctx = document.getElementById('caffeine-chart').getContext('2d');
    caffeineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Caffeine Intake',
                data: [],
                borderColor: 'rgba(39, 39, 103, 1)',
                backgroundColor: 'rgba(39, 39, 103, 0.8)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return `Day: ${tooltipItems[0].label}`;
                        },
                        label: function(tooltipItem) {
                            return `Caffeine: ${tooltipItem.raw} mg`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Caffeine (mg)',
                    }
                }
            }
        }
    });
}
initializeCaffeineChart();
loadCupMetrics();

function updateCupChart(cups) {
    const today = new Date('2024-12-10T00:00:00');
    //const today = new Date();
    var last7Days = [];
    for (var i = 6; i >= 0; i--) {
        var date = new Date(today);
        date.setDate(today.getDate() - i);
        last7Days.push(date);
    }
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const cupCounts = new Array(7).fill(0);
    const drinkTypesByDay = new Array(7).fill().map(() => ({}));

    cups.forEach(cup => {
        var cupDate = new Date(cup.InitialReadTime);
        var dayOfWeek = cupDate.getDay();
        var weekdayIndex = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);

        cupCounts[weekdayIndex] += 1;
        const drinkType = cup.Type;
        if (drinkTypesByDay[weekdayIndex][drinkType]) {
            drinkTypesByDay[weekdayIndex][drinkType] += 1;
        } else {
            drinkTypesByDay[weekdayIndex][drinkType] = 1;
        }
    });

    cupChart.data.labels = weekdays;
    cupChart.data.datasets[0].data = cupCounts;
    cupChart.options.plugins.tooltip.callbacks.afterLabel = function(tooltipItem) {
        const dayIndex = tooltipItem.dataIndex;
        const drinks = drinkTypesByDay[dayIndex];
        return Object.entries(drinks)
            .map(([type, count]) => `${count}x ${type}`)
            .join('\n');
    };
    cupChart.update();
}

let cupChart;

function initializeCupChart() {
    const ctx = document.getElementById('cup-chart').getContext('2d');
    cupChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Cups Consumed',
                data: [],
                borderColor: 'rgba(39, 39,103, 1)',
                backgroundColor: 'rgba(149, 119, 185, 0.8)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return `Day: ${tooltipItems[0].label}`;
                        },
                        label: function(tooltipItem) {
                            return `Cups: ${tooltipItem.raw}`;
                        },
                        afterLabel: function(tooltipItem) {
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Cups',
                    },
                    min: 0,
                    max: 5,
                    ticks: {
                        stepSize: 1,
                    }
                }
            }
        }
    });
}

initializeCupChart();