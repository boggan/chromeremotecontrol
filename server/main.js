var fs = require('fs'),
    path = require('path'),
    NetworkMgr = require('./js/NetworkMgr'),
    // config = require('./config.js'),
    WebSocketServer = require("ws").Server;


//=============================================================================
function cDashboardApp() {
    //=============================================================================
    // Public methods
    //=============================================================================
    this.getChromeList = function() {
        var l_sId,
            l_aChromeList = [];

        for (l_sId in m_oChromeClientList) {
            l_aChromeList.push(l_sId);
        }

        return l_aChromeList;
    };

    //=============================================================================
    this.getTabsList = function(i_sChromeId) {
        return m_oStorage[i_sChromeId];
    };

    //=============================================================================
    this.getClientConfig = function(i_sChromeId) {
        var l_oConfig;

        if (m_oChromeClientList[i_sChromeId]) {
            l_oConfig = m_oChromeClientList[i_sChromeId].config;
        }

        return l_oConfig || {};
    };

    //=============================================================================
    this.getCarouselStatus = function(i_sChromeId) {
        var l_bRunning = false;

        if (m_oChromeClientList[i_sChromeId]) {
            l_bRunning = m_oChromeClientList[i_sChromeId].carouselRunning || false;
        }

        return l_bRunning;
    }

    //=============================================================================
    // Private methods
    //=============================================================================

    //=============================================================================
    function _getActiveTab(i_sChromeId) {
        var l_oTab = null;

        if (m_oStorage[i_sChromeId]) {
            l_oTab = m_oStorage[i_sChromeId].find(i_oTab => i_oTab.active);
        }

        return l_oTab;
    }

    //=============================================================================
    function _getTab(i_sChromeId, i_nTabId) {
        var l_oTab = null;

        if (m_oStorage[i_sChromeId]) {
            l_oTab = m_oStorage[i_sChromeId].find(i_oTab => i_oTab.id === i_nTabId);
        }

        return l_oTab;
    }

    //=============================================================================
    function _removeTab(i_sChromeId, i_nTabId, i_bFromWeb) {
        var l_nTabIndex,
            l_oTabData,
            l_bProceed = true,
            l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (i_bFromWeb && l_oChromeSocket) {
            // console.log("Chrome Socket: ", l_oChromeSocket.config);
            l_bProceed = l_oChromeSocket.config && l_oChromeSocket.config.allowRemove;
        }

        if (l_bProceed) {
            if (l_oChromeSocket && m_oStorage[i_sChromeId]) {
                l_nTabIndex = m_oStorage[i_sChromeId].findIndex(i_oTab => i_oTab.id === i_nTabId);
                if (l_nTabIndex > -1) {
                    m_oStorage[i_sChromeId].splice(l_nTabIndex, 1);
                }

                l_oChromeSocket.send(JSON.stringify({
                    type: "remove",
                    tabId: i_nTabId
                }));
            } else {
                delete m_oChromeClientList[i_sChromeId];
                delete m_oStorage[i_sChromeId];
            }
        }
    }

    //=============================================================================
    function _reloadTab(i_sChromeId, i_nTabId) {
        var l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (l_oChromeSocket && l_oChromeSocket.config && l_oChromeSocket.config.allowReload) {
            l_oChromeSocket.send(JSON.stringify({
                type: "reload",
                tabId: i_nTabId
            }));
        }
    }

    //=============================================================================
    function _selectTab(i_sChromeId, i_nTabId) {
        var l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (l_oChromeSocket && l_oChromeSocket.config && l_oChromeSocket.config.allowSelect) {
            l_oChromeSocket.send(JSON.stringify({
                type: "select",
                tabId: i_nTabId
            }));
        }
    }

    //=============================================================================
    function _toggleCarousel(i_sChromeId, i_bRun) {
        var l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (l_oChromeSocket && l_oChromeSocket.config && l_oChromeSocket.config.enableCarousel) {
            l_oChromeSocket.send(JSON.stringify({
                type: "toggleCarousel",
                running: i_bRun
            }));
        }
    }

    //=============================================================================
    function _sendConfig(i_sChromeId, i_oConfig) {
        var l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (l_oChromeSocket && l_oChromeSocket.config && l_oChromeSocket.config.enableCarousel) { // only carousel config is allowed to be published
            l_oChromeSocket.send(JSON.stringify({
                type: "config",
                config: i_oConfig
            }));
        }
    }

    //=============================================================================
    function _updateCarouselStatus(i_sChromeId, i_bRunning) {
        var l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (l_oChromeSocket) {
            l_oChromeSocket.carouselRunning = i_bRunning;
        }
    }

    //=============================================================================
    function _sendCreateTab(i_sChromeId, i_sURL) {
        var l_oChromeSocket = m_oChromeClientList[i_sChromeId];

        if (l_oChromeSocket && l_oChromeSocket.config.allowAdd) {
            l_oChromeSocket.send(JSON.stringify({
                type: "create",
                tabUrl: i_sURL
            }));
        }
    }

    //=============================================================================
    function _addTab(i_sChromeId, i_oTab) {
        if (m_oStorage[i_sChromeId]) {
            m_oStorage[i_sChromeId].push(i_oTab);
        }
    }

    //=============================================================================
    function _getWebClientIndex(i_oWebSocket) {
        return m_aWebClientList.findIndex(i_oSocket => i_oSocket === i_oWebSocket);
    }

    //=============================================================================
    function _broadcastToWeb(i_oMsg) {
        // console.log("\n\n\n BROADCASTING TO WEB CLIENTS ");
        m_aWebClientList.forEach((i_oSocket, i) => {
            // console.log("\n\n\n BROADCASTING TO WEB CLIENTS ", i);
            i_oSocket.send(JSON.stringify(i_oMsg));
        });
    }

    //=============================================================================
    function _startWebSocketServer(i_oServer) {
        var l_oWSServer = new WebSocketServer({
            server: i_oServer
        });

        l_oWSServer.on('connection', function(i_oClientSocket) {
            // console.log("new Chrome client Connection");

            i_oClientSocket.on('message', function(i_sMsg) {
                var l_oMsg = JSON.parse(i_sMsg);

                if (l_oMsg.src === "chromeExt") {
                    _handleExtensionMsgs(l_oMsg, i_oClientSocket);
                } else if (l_oMsg.src === "web") {
                    var l_bTriggerRefresh = false;
                    switch (l_oMsg.type) {
                        case "register":
                            m_aWebClientList.push(i_oClientSocket);
                            break;
                        case "create":
                            _sendCreateTab(l_oMsg.chromeId, l_oMsg.tabUrl);
                            break;
                        case "remove":
                            _removeTab(l_oMsg.chromeId, l_oMsg.tabId, true);
                            l_bTriggerRefresh = true;
                            break;
                        case "reload":
                            _reloadTab(l_oMsg.chromeId, l_oMsg.tabId);
                            break;
                        case "select":
                            _selectTab(l_oMsg.chromeId, l_oMsg.tabId);
                            break;
                        case "toggleCarousel":
                            _toggleCarousel(l_oMsg.chromeId, l_oMsg.run);
                            break;
                        case "config":
                            _sendConfig(l_oMsg.chromeId, l_oMsg.config);
                            break;
                    }

                    if (l_bTriggerRefresh) {
                        _broadcastToWeb({
                            type: "refresh"
                        });
                    }

                }
            });

            i_oClientSocket.on('close', function() {
                // console.log("Socket Connection closed! ");
                if (i_oClientSocket.id) {
                    // chrome client
                    delete m_oChromeClientList[i_oClientSocket.id];
                } else {
                    var l_nIndex = m_aWebClientList.findIndex(i_oSocket => i_oSocket === i_oClientSocket);
                    // console.log("Found Web Client index: ", l_nIndex);
                    m_aWebClientList.splice(l_nIndex, 1);
                }

            });
        });
    }

    //=============================================================================
    function _handleExtensionMsgs(i_oMsg, i_oClientSocket) {
        var l_oMsg = i_oMsg || {},
            l_bTriggerRefresh = false,
            l_oTab;

        // keep track of chrome clients
        if (l_oMsg.id && !m_oChromeClientList[l_oMsg.id]) {
            i_oClientSocket.id = l_oMsg.id;
            m_oChromeClientList[l_oMsg.id] = i_oClientSocket;
        }

        switch (l_oMsg.type) {
            case "config":
                console.log("Config Received for : ", l_oMsg.id);
                m_oChromeClientList[l_oMsg.id].config = l_oMsg.config;
                l_bTriggerRefresh = true;
                break;
            case "tabList":
                m_oStorage[l_oMsg.id] = l_oMsg.tabs;
                break;
                // case "tabCreated":
                //     break;
                // case "tabUpdated":
                //     break;
            case "tabCreated":
                l_bTriggerRefresh = true;
                _addTab(l_oMsg.id, l_oMsg.tab);
                break;
            case "tabActiveChanged":
                // find currently active tab
                // console.log('Client Socket message received from : %s of type %s', l_oMsg.id, l_oMsg.type);
                l_bTriggerRefresh = true;
                l_oTab = _getActiveTab(l_oMsg.id);
                if (l_oTab) {
                    l_oTab.active = false;
                }

                l_oTab = _getTab(l_oMsg.id, l_oMsg.tabId);
                if (l_oTab) {
                    l_oTab.active = true;
                }
                break;
            case "tabRemoved":
                l_bTriggerRefresh = true;
                console.log('Client Socket message received from : %s of type %s', l_oMsg.id, l_oMsg.type);
                _removeTab(l_oMsg.id, l_oMsg.tabId);
                break;
            case "carouselStatus":
                _updateCarouselStatus(l_oMsg.id, l_oMsg.running);
                l_bTriggerRefresh = true;
                break;
        }

        if (l_bTriggerRefresh) {
            _broadcastToWeb({
                type: "refresh"
            });
        }
    }

    //=============================================================================
    function _constructor_() {
        var l_oNetworkMgr = new NetworkMgr(m_oInterface),
            l_oServer;

        l_oServer = l_oNetworkMgr.startServer();
        console.log("Web Server Started...");
        _startWebSocketServer(l_oServer);
        console.log("Socket Server Started...");
    }

    //=============================================================================
    // Private Members
    //=============================================================================
    var m_oInterface = this,
        m_oStorage = {},
        m_oChromeClientList = {},
        m_aWebClientList = []; // convert to set ?

    _constructor_();
}


//=============================================================================
function main() {
    var l_oDashboardApp = new cDashboardApp();
}

main();
