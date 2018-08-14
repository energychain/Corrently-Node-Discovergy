#!/usr/bin/env node

var startStopDaemon = require('start-stop-daemon');

startStopDaemon({}, function() {

  require('dotenv').config();
  var service = require("corrently-node");
  service(function(db,kv) {
    var discovergy = require("./discovergy.js");
    var meters=process.env.DISCOVERGY_METERS.split(",");

    var updateMeter=function() {
        if(meters.length>0) {
            var meterid = meters.pop();
            discovergy(db,meterid,function() {
                updateMeter();
            });
        } else {
            console.log("Start seeding");
            // process.exit();
        }
    }
    updateMeter();
    setInterval(updateMeter,process.env.IDLE_REPUBLISH);
  });
});
