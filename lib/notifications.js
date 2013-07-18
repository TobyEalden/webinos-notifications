(function(exports) {
  var fs = require('fs');
  var path = require('path');
  var webinosPath = require("webinos-utilities").webinosPath.webinosPath();
  var eventEmitter = require('events').EventEmitter;
  var util = require('util');
  var uuid = require('node-uuid');
  var filePath;
  var locked = false;

  function getListFilename() {
    var f;
    if (typeof filePath === "undefined") {
      f = path.join(webinosPath,"userData/notifications.json");
    } else {
      f = path.join(filePath,"userData/notifications.json");
    }
    return f;
  }

  function loadList() {
    var listFile = getListFilename();
    var list;
    if (fs.existsSync(listFile)) {
    var fileContents = fs.readFileSync(listFile);
      list = JSON.parse(fileContents);
    } else {
      list = { notifications: {} };
    }
    return list;
  }

  function saveList(list) {
    var listFile = getListFilename();
    var fileContents = JSON.stringify(list,null,2);
    fs.writeFileSync(listFile,fileContents);
  }

  var NotificationManager = function() {
    eventEmitter.call(this);
    this.notifyType = {
      all: "all",
      notification: "notification",
      permissionRequest: "permissionRequest",
      permissionResponse: "permissionResponse",
      connectionRequest: "connectionRequest",
      sync: "sync"
    };
  };

  util.inherits(NotificationManager, eventEmitter);

  // Retrieve a specific notification from the list
  NotificationManager.prototype.getNotification = function(id) {
    var list = loadList();

    var notify;
    if (list.notifications.hasOwnProperty(id)) {
      notify = list.notifications[id];
    }

    return notify;
  };

  // Retrieve all notifications (optionally of a given type)
  NotificationManager.prototype.getNotifications = function(type) {
    var list = loadList();

    var lst = { notifications: {}};

    for (var id in list.notifications) {
      if (list.notifications.hasOwnProperty(id) && (typeof type === "undefined" || list.notifications[id].type === type)) {
        lst.notifications[id] = list.notifications[id];
      }
    }

    return lst;
  };

  NotificationManager.prototype.addNotification = function(type,data) {
    locked = true;

    var notify = {};

    try {
      var list = loadList();

      console.log("NOTIFICATIONS - adding: " + util.inspect(data));

      notify.id = uuid.v1();
      notify.timestamp = new Date();
      notify.type = type;
      notify.data = data;
      list.notifications[notify.id] = notify;
      saveList(list);

      this.emit(notify.type, notify);
      this.emit(this.notifyType.all, notify);
    } catch (e) {
      console.log("error during notificationManger.addNotification: " + e.message);
    } finally {
      locked = false;
    }

    return notify;
  };

  // Remote initiated sync occurred (we received updates from PZH)
  NotificationManager.prototype.updateAfterRemoteSync = function(remoteList) {
    var syncList = loadList();
    var nId;
    var newItems = [];

    for (nId in remoteList.notifications) {
      if (remoteList.notifications.hasOwnProperty(nId) && !syncList.notifications.hasOwnProperty(nId)) {
        // Notification not found in sync list - add it.
        var notify = remoteList.notifications[nId];
        console.log("NOTIFICATION - sync adding: " + util.inspect(notify));
        syncList.notifications[nId] = notify;
        newItems.push(notify);
      }
    }

    if (newItems.length > 0) {
      saveList(syncList);

      for (var n in newItems) {
        this.emit(notify.type, newItems[n]);
        this.emit(this.notifyType.all, newItems[n]);
      }
    }

    return newItems.length > 0;
  };

  exports.setFilePath = function(fp) { filePath = fp; };
  exports.notificationManager = new NotificationManager();
  exports.PromptHandler = require("./handlers/promptNotificationHandler/promptHandler").Handler;
  exports.TrayHandler = require("./handlers/trayNotificationHandler/trayHandler").Handler;
  exports.EmailHandler = require("./handlers/emailNotificationHandler/emailHandler").Handler;

})(module.exports);