#!/usr/bin/env node

var startStopDaemon = require('start-stop-daemon');

startStopDaemon({}, function() {

  require('dotenv').config();
  var crypto = require('crypto');
  var encrypt=function(text,password){
    var cipher = crypto.createCipher('aes-256-ctr',password)
    var crypted = cipher.update(text,'utf8','hex')
    crypted += cipher.final('hex');
    return crypted;
  }

  var decrypt=function(text,password){
    var decipher = crypto.createDecipher('aes-256-ctr',password)
    var dec = decipher.update(text,'hex','utf8')
    dec += decipher.final('utf8');
    return dec;
  }

  const PouchDB = require('pouchdb');
  const localPouch = PouchDB.defaults();
  localPouch.plugin(require('pouchdb-upsert'));
  var db = new localPouch("http://localhost:"+process.env.POUCHDB_FAUXTON_PORT+"/local");
  const commandLineArgs = require('command-line-args');
  const optionDefinitions = [
    { name: 'daemonize', alias: 'd',type: Boolean } ,
    { name: 'start', type: Boolean },
    { name: 'stop', type: Boolean },
    { name: 'restart', type: Boolean }
  ];
  const options = commandLineArgs(optionDefinitions);
    console.log("Starting Discovergy Service");
    var discovergyService=function() {

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
      if((typeof options.start != "undefined")||(typeof options.restart != "undefined")||(typeof options.daemonize != "undefined")) {
        setInterval(updateMeter,process.env.IDLE_REPUBLISH);
      }

    }
    var retrieveConfig = function() {
        db.get("config-discovergy").then(function(doc) {
          var config = JSON.parse(decrypt(doc.config,process.env.PRIVATEKEY));
          process.env.DISCOVERGY_METERS=config.DISCOVERGY_METERS;
          process.env.DISCOVERGY_USERNAME=config.DISCOVERGY_USERNAME;
          process.env.DISCOVERGY_PASSWORD=config.DISCOVERGY_PASSWORD;
          console.log("Retrieved Config");
          doc.lastUpdate=new Date();
          db.put(doc);

          discovergyService();

        }).catch(function() {
          if(typeof process.env.DISCOVERGY_METERS!="undefined") {
              var config={};
              config.DISCOVERGY_METERS=process.env.DISCOVERGY_METERS;
              config.DISCOVERGY_USERNAME=process.env.DISCOVERGY_USERNAME;
              config.DISCOVERGY_PASSWORD=process.env.DISCOVERGY_PASSWORD;
              var config_encrypted=encrypt(JSON.stringify(config),process.env.PRIVATEKEY);
              db.put({_id:'config-discovergy',config:config_encrypted}).then(function(e) {
                  console.log("Finished Setup",e);
                  discovergyService();
              });
          } else {
              console.log("No configuration found will try again, maybe need to be published by remote peer");
              setTimeout(function() {
                  retrieveConfig();
              },60000);
          }
      });
    };
    retrieveConfig();

});
