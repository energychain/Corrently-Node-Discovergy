
module.exports = async function(db,meterid,cbmain) {
  var fillHistoryDb=function(historic_days,max_ts) {
  return new Promise(function(resolve3,reject3) {
  const apirequest=require("request");
  var day=86400000;

  var itterations=2;

  function consumer(vector,to) {
    return new Promise(function(resolve,reject) {
      from=new Date(to).getTime()-(vector.timestep*((itterations*2)*vector.contextstep));
        var request_options={};
        request_options={
            url:"https://"+process.env.DISCOVERGY_USERNAME+":"+process.env.DISCOVERGY_PASSWORD+"@api.discovergy.com/public/v1/readings?meterId="+meterid+"&resolution="+vector.resolution+"&from="+new Date(from).getTime()+"&to="+new Date(to).getTime()
        }
        apirequest(request_options,function(e,r,body) {
            var body = JSON.parse(body)
            if(body.length<vector.contextstep+1) { console.log("To small",vector.resolution,body.length,(itterations+0)*vector.contextstep); resolve(1);   } else {
              var halbwert=1;
              var halbwert_sum=0;
              var latest=body.length-1;
              var p_sum=0;
              for(var i=0;i<itterations;i++) {
                if((body.length-2)-(i*vector.contextstep)>=0) {
                  p_sum+=Math.abs((body[(body.length-2)-(i*vector.contextstep)].values.power)*halbwert);
                  halbwert_sum+=halbwert;
                  halbwert*=0.75;
                } else {
                  console.log("Body.Length - i to small",vector.resolution);
                }
              }
              var p_history=p_sum/halbwert_sum;
              var p_now=body[body.length-1].values.power;
              resolve(Math.abs(p_now/p_history));
            }

        });
    })
  }

  function doRetrieve(days_past) {
    return new Promise(function(resolve,reject) {
      try {
      var vectors=[];
      vectors.push({resolution:"one_hour",limit:90*day,contextstep:24,timestep:3600000,relevance:10});
      vectors.push({resolution:"one_day",limit:10*365*day,contextstep:1,timestep:day,relevance:20});
      vectors.push({resolution:"one_month",limit:10*365*day,contextstep:12,timestep:day*30,relevance:50});
      vectors.push({resolution:"one_year",limit:10*365*day,contextstep:1,timestep:366*day,relevance:20});

      var performance=0;
      var performances=0;
      var to=new Date().getTime()-(days_past*day);
      function getPerformance() {
        try {
              if(vectors.length>0) {
                  var vector=vectors.pop();
                  consumer(vector,to).then(function(x) {
                      if((x!=null)&&(!isNaN(x))) {
                        performances+=vector.relevance;
                        performance+=(x*vector.relevance);
                      }
                      getPerformance();
                  });
              } else {

                var d = new Date(to);
                d.setHours(0,0,0,0);
                resolve({ts:d.getTime()+8640000,p:performance/performances});
              }
        } catch(e) {console.log(e);reject();}
      }

      getPerformance();
    } catch(e) {console.log(e);reject();}

    });
  }


  function fillHistory() {
    if(historic_days>0) {
    doRetrieve(historic_days).then(function(last_performance) {
            if((last_performance.ts>max_ts)&&(last_performance.p!=null)) {
              console.log(last_performance);
              history.push(last_performance);
            }
            //history[last_performance.ts]=last_performance.p;
            historic_days--;
            fillHistory();
    });
    } else {
      resolve3();
    }
  }

  fillHistory();
  });
}

  console.log("Discovergy Processing");
    db.get(meterid).then(function(doc) {
        history=doc.values;
        if(typeof doc.values=="undefined") history=[];
        var max_ts=0;
        for(var i=0;i<history.length;i++) {
          if(history[i].ts>max_ts) max_ts=history[i].ts;
        }

        if(new Date().getTime()-max_ts>86400000) {
              var days=Math.floor((new Date().getTime()-max_ts)/86400000);
              fillHistoryDb(days,max_ts).then(function(x) {

                doc.values=history;
                db.put(doc)
                      .then(function(c) {
                        if(typeof cbmain=="function") cbmain();
                      }).catch(function(e) {console.log(e);});
              });
        } else {
            if(typeof cbmain=="function") cbmain();
        }
    }).catch(function(e) {
        console.log(e);
        history=[];
        fillHistoryDb(360,0).then(function(x) {
          doc = {};
          doc.id=meterid;
          doc._id=meterid;
          doc.values=history;
          db.put(doc)
                .then(function(c) { if(typeof cbmain=="function") cbmain();  });
        });
    });
}
