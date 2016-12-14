var g_oConfig,
    g_sWSURL,
    g_sChromeId = "chrome-" + Math.round(Math.random() * 1e10),
    g_nWatchdogHandle,
    g_oSocket = null,
    g_aTabsList = [],
    g_nCarouselIntervalHandle = null,
    g_nAutoReloadIntervalHandle = null,
    g_nCarouselActiveIndex;

//==============================================================================
function retryConnection() {
    g_nWatchdogHandle = setTimeout(() => {
        connectWebSocket();
    }, (g_oConfig.reconnectInterval || DEFAULT_CONFIG.reconnectInterval));
}

//==============================================================================
function stopWatchdog() {
    clearTimeout(g_nWatchdogHandle);
    g_nWatchdogHandle = null;
}

//==============================================================================
function isSocketConnected() {
    return g_oSocket && g_oSocket.readyState === WebSocket.OPEN;
}

//==============================================================================
function cloneObject(i_oObject) {
    return JSON.parse(JSON.stringify(i_oObject));
}

//==============================================================================
function sendMessage(i_oMsg) {
    var l_oMsg;
    if (isSocketConnected() && i_oMsg) {
        l_oMsg = cloneObject(i_oMsg);
        l_oMsg.id = g_sChromeId;
        l_oMsg.src = "chromeExt";

        g_oSocket.send(JSON.stringify(l_oMsg));
    }
}

//==============================================================================
function updateTabsList() {
    return new Promise(i_oResolve => {
        chrome.tabs.query({}, i_aTabsList => {
            g_aTabsList = i_aTabsList;
            i_oResolve(g_aTabsList);
        });
    });
}

//==============================================================================
function sendConfig() {
    sendMessage({
        type: "config",
        config: g_oConfig
    });
}

//==============================================================================
function sendCarouselUpdate() {
    sendMessage({
        type: "carouselStatus",
        running: g_nCarouselIntervalHandle !== null
    });
}

//==============================================================================
function sendTabList() {
    updateTabsList()
        .then((i_aTabsList) => {
            sendMessage({
                type: "tabList",
                tabs: i_aTabsList
            });
        })
}

//==============================================================================
function connectWebSocket() {
    try {
        stopWatchdog();
        g_oSocket = new WebSocket(g_sWSURL);
        // readyState -> WebSocket.CONNECTING, WebSocket.OPEN, WebSocket.CLOSING, WebSocket.CLOSED

        g_oSocket.onopen = function(e) {
            // console.log("Web Socket Opened to ", g_sWSURL, " e : ", e);
            sendConfig();
            sendTabList();
            sendCarouselUpdate();
        };

        g_oSocket.onclose = function(e) {
            // console.log("Socket connection closed!", e);
            if (!g_nWatchdogHandle) {
                retryConnection();
            }
        };

        g_oSocket.onerror = function(e) {
            console.error("Web Socket error ", e);
        };

        g_oSocket.onmessage = function(i_oMessage, flags) {
            var l_oMsg = JSON.parse(i_oMessage.data);

            switch (l_oMsg.type) {
                case "create":
                    if (g_oConfig.allowAdd) {
                        chrome.tabs.create({
                            url: l_oMsg.tabUrl
                        });
                    }
                    break;
                case "remove":
                    if (g_oConfig.allowRemove) {
                        chrome.tabs.remove(Number(l_oMsg.tabId), sendTabList);
                    }
                    break;
                case "reload":
                    if (g_oConfig.allowReload) {
                        chrome.tabs.reload(Number(l_oMsg.tabId), {
                            // bypassCache: true
                        }, sendTabList);
                    }
                    break;
                case "select":
                    selectTab(Number(l_oMsg.tabId));
                    break;
                case "toggleCarousel":
                    if (g_oConfig.enableCarousel) {
                        if (l_oMsg.running && !g_nCarouselIntervalHandle) {
                            startCarousel();
                        } else {
                            stopCarousel();
                        }
                    }
                    break;
                case "config":
                    updateConfig(l_oMsg.config);
                    break;
            }
        };
    } catch (e) {
        console.warn("connectWebSocket: Exception caught", e);
    }
}

//==============================================================================
function updateConfig(i_oNewConfigs) {
    var l_oUpdatedConfig;

    if (g_oConfig.enableCarousel && i_oNewConfigs.carouselInterval) {
        l_oUpdatedConfig = {
            carouselInterval: Number(i_oNewConfigs.carouselInterval) || DEFAULT_CONFIG.carouselInterval
        };
    }

    if (g_oConfig.enableAutoReload && i_oNewConfigs.autoReloadInterval) {
        l_oUpdatedConfig = {
            autoReloadInterval: Number(i_oNewConfigs.autoReloadInterval) || DEFAULT_CONFIG.autoReloadInterval
        };
    }

    if (l_oUpdatedConfig) {
        chrome.storage.sync.set(i_oNewConfigs);
    }

}

//==============================================================================
function selectTab(i_nTabId) {
    if (g_oConfig.allowSelect) {
        chrome.tabs.update(i_nTabId, {
            active: true
        }, carouselSelectTab);
    }
}

//==============================================================================
function carouselSelectTab(i_oActiveTab) {
    var l_nTabIndex;

    l_nTabIndex = g_aTabsList.findIndex(i_oTab => i_oTab.id === i_oActiveTab.id);
    if (l_nTabIndex > -1) {
        g_nCarouselActiveIndex = l_nTabIndex;
    }
}

//==============================================================================
function carouselActivateNextTab() {
    var l_oTabToActivate;

    g_nCarouselActiveIndex++;

    if (g_nCarouselActiveIndex >= g_aTabsList.length) {
        g_nCarouselActiveIndex = 0;
    }

    l_oTabToActivate = g_aTabsList[g_nCarouselActiveIndex];
    if (l_oTabToActivate) {
        chrome.tabs.update(l_oTabToActivate.id, {
            active: true
        }, () => {
            updateTabsList();
            g_nCarouselIntervalHandle = setTimeout(carouselActivateNextTab, Math.max(MIN_CAROUSEL_INTERVAL, g_oConfig.carouselInterval));
        });
    }
}

//==============================================================================
function startCarousel() {
    stopCarousel(true)
        .then(() => {
            // find active tab
            g_nCarouselActiveIndex = g_aTabsList.findIndex(i_oTab => i_oTab.active);
            g_nCarouselIntervalHandle = setTimeout(carouselActivateNextTab, Math.max(MIN_CAROUSEL_INTERVAL, g_oConfig.carouselInterval));

            chrome.browserAction.setTitle({
                title: 'Stop carousel'
            });

            chrome.browserAction.setIcon({
                path: "assets/images/carousel_running.png"
            }, sendCarouselUpdate);
        });
}

//==============================================================================
function stopCarousel(i_bSilent) {
    return new Promise(i_oResolve => {
        clearTimeout(g_nCarouselIntervalHandle);
        g_nCarouselIntervalHandle = null;
        chrome.browserAction.setTitle({
            title: 'Start carousel'
        });
        
        chrome.browserAction.setIcon({
            path: "assets/images/carousel_stopped.png"
        }, () => {
            if (!i_bSilent) {
                sendCarouselUpdate();
            }
            i_oResolve();
        });
    });
}

//==============================================================================
function reloadAllTabs() {
    chrome.tabs.query({}, i_aTabs => {
        i_aTabs.forEach(i_oTab => chrome.tabs.reload(i_oTab.id));
    });
}

//==============================================================================
function startAutoReload() {
    stopAutoReload();
    setInterval(reloadAllTabs, Math.max(MIN_AUTORELOAD_INTERVAL, g_oConfig.autoReloadInterval));
}

//==============================================================================
function stopAutoReload() {
    clearInterval(g_nAutoReloadIntervalHandle);
    g_nAutoReloadIntervalHandle = null;
}

//==============================================================================
function toggleCarousel() {
    if (g_nCarouselIntervalHandle) {
        stopCarousel();
    } else {
        startCarousel();
    }
}

/*******************************************************************************
 * Tabs Listeners
 *******************************************************************************/

chrome.storage.onChanged.addListener(function(changes, namespace) {

    window.location.reload();
});

chrome.tabs.onCreated.addListener(function(i_oTab) {
    // console.log("[onCreated] Event Received: ", i_oTab);
    g_aTabsList.push(i_oTab);
    sendMessage({
        type: "tabCreated",
        tab: i_oTab
    });
});

chrome.tabs.onUpdated.addListener(function(i_nTabId) {
    // console.log("[onUpdated] Event Received Tab Id: ", i_nTabId);
    chrome.tabs.get(i_nTabId, i_oTab => {
        sendMessage({
            type: "tabUpdated",
            tab: i_oTab
        });
    });
});

chrome.tabs.onActiveChanged.addListener(function(i_nTabId) {
    // console.log("[onActiveChanged] Event Received: ", i_nTabId);
    sendMessage({
        type: "tabActiveChanged",
        tabId: i_nTabId
    });
});


chrome.tabs.onRemoved.addListener(function(i_nTabId) {
    // console.log("[onRemoved] Event Received: ", i_nTabId);
    sendMessage({
        type: "tabRemoved",
        tabId: i_nTabId
    });
});

/*******************************************************************************
 * Main Execution
 *******************************************************************************/

chrome.storage.sync.get(i_oConfig => {
    g_oConfig = Object.assign(DEFAULT_CONFIG, i_oConfig);
    g_sWSURL = "ws://" + (g_oConfig.host || DEFAULT_CONFIG.host) + ":" + (g_oConfig.port || DEFAULT_CONFIG.port);

    updateTabsList()
        .then(i_aTabsList => {
            chrome.browserAction.onClicked.addListener(toggleCarousel);
            if (g_oConfig.enableCarousel) {
                // start carousel
                startCarousel();
            }

            if (g_oConfig.enableAutoReload) {
                startAutoReload();
            }
            connectWebSocket();
        });
});
