var g_oSocket,
    g_sAuthToken,
    g_oConfig;

//======================================================================
function render() {
    var l_oPromise;

    if (g_sAuthToken) {
        $('#login-container').hide();
        $('section.settings, section.tabs, #logout-btn').show();
        
        l_oPromise = renderContent();
    } else {
        $('#login-container').show();
        $('section.settings, section.tabs, #logout-btn').hide();
        l_oPromise = new Promise(i_oResolve => i_oResolve());
    }

    return l_oPromise;
}

//======================================================================
function renderContent() {
    return _getChromeList()
        .then(_renderChromeList)
        .then(_getChromeConfig)
        .then(_getCarouselStatus)
        .then(_getTabsList)
        .then(_renderTabList)
        .then(_registerDOMEvents);
}

//======================================================================
function _getChromeList() {
    return new Promise(i_oResolve => {
        var l_oXHR = new XMLHttpRequest();
        l_oXHR.open("GET", "/api/chrome/list", true);
        l_oXHR.setRequestHeader("authtoken", g_sAuthToken);
        l_oXHR.onload = function() {
            i_oResolve(JSON.parse(l_oXHR.responseText));
        };
        l_oXHR.send();
    });
}

//======================================================================
function _renderChromeList(i_aChromeList) {
    var l_oDOMChromeList = $('#chrome-list');

    l_oDOMChromeList.empty();
    i_aChromeList.forEach(i_sChromeId => {
        l_oDOMChromeList.append('<option id="' + i_sChromeId + '">' + i_sChromeId + '</option>');
    });

    return i_aChromeList[0];
}

//======================================================================
function _getChromeConfig(i_sChromeId) {
    return new Promise(i_oResolve => {
        var l_oXHR = new XMLHttpRequest();
        l_oXHR.open("GET", "/api/chrome/" + i_sChromeId + "/config", true);
        l_oXHR.setRequestHeader("authtoken", g_sAuthToken);
        l_oXHR.onload = function() {
            g_oConfig = JSON.parse(l_oXHR.responseText);

            if (g_oConfig.allowAdd) {
                $('#add-tab-container').show();
            } else {
                $('#add-tab-container').hide();
            }

            if (g_oConfig.enableCarousel) {
                $('#carousel-cycle-time').val(g_oConfig.carouselInterval);
                $('#carousel-ctrl-container').show();
            } else {
                $('#carousel-ctrl-container').hide();
            }

            $("#autoreload-status").html(g_oConfig.enableAutoReload ? "Enabled" : "Disabled");
            $("#auto-reload-cycle-time").val(g_oConfig.autoReloadInterval);

            i_oResolve(i_sChromeId);
        };
        l_oXHR.send();
    });
}

//======================================================================
function _getCarouselStatus(i_sChromeId) {
    return new Promise(i_oResolve => {
        var l_oXHR = new XMLHttpRequest();
        l_oXHR.open("GET", "/api/chrome/" + i_sChromeId + "/carousel/status", true);
        l_oXHR.setRequestHeader("authtoken", g_sAuthToken);
        l_oXHR.onload = function() {
            var l_bRunning = /true/i.test(l_oXHR.responseText);
            $('#carousel-status').html(l_bRunning ? "Running..." : "Stopped");
            i_oResolve(i_sChromeId);
        };
        l_oXHR.send();
    });
}

//======================================================================
function _getTabsList(i_sChromeId) {
    return new Promise(i_oResolve => {
        var l_oXHR = new XMLHttpRequest();
        l_oXHR.open("GET", "/api/chrome/" + i_sChromeId + "/tabs/list", true);
        l_oXHR.setRequestHeader("authtoken", g_sAuthToken);
        l_oXHR.onload = function() {
            i_oResolve(JSON.parse(l_oXHR.responseText));
        };
        l_oXHR.send();
    });
}

//======================================================================
function _renderTabList(i_aTabsList) {
    var l_oDOMTabsList = $('#tabs-list');

    l_oDOMTabsList.empty();
    i_aTabsList.forEach(i_oTab => {
        var l_sHTML = '<li id="' + i_oTab.id + '"';
        if (i_oTab.active) {
            l_sHTML += ' class="active"';
        }
        l_sHTML += '>';

        l_sHTML += '<div>';

        if(i_oTab.favIconUrl){
            l_sHTML += '<img class="favicon" src="' + i_oTab.favIconUrl + '">';            
        }else{
            l_sHTML += '<div class="flex-filler"></div>';                        
        }

        if(i_oTab.title){
            l_sHTML += '<a class="title" target="_blank" href="' + i_oTab.url  + '">' + i_oTab.title + '</a>';            
        }

        l_sHTML += '</div><div>';

        if (g_oConfig.allowSelect) {
            l_sHTML += '<button class="select-tab-btn btn" data-tabid="' + i_oTab.id + '">Select</button>';
        }

        if (g_oConfig.allowReload) {
            l_sHTML += '<button class="reload-tab-btn btn" data-tabid="' + i_oTab.id + '">Reload</button>';
        }

        if (g_oConfig.allowRemove) {
            l_sHTML += '<button class="remove-tab-btn btn danger-bg" data-tabid="' + i_oTab.id + '">Remove</button>';
        }

        l_sHTML += '</div>';

        l_sHTML += '</li>';
        l_oDOMTabsList.append(l_sHTML);
    });
}

//======================================================================
function _registerDOMEvents() {
    $('.remove-tab-btn').unbind();
    $('.reload-tab-btn').unbind();
    $('.select-tab-btn').unbind();

    $("#carousel-cycle-time").unbind();
    $('#carousel-start-btn').unbind();
    $('#carousel-stop-btn').unbind();
    $('#auto-reload-cycle-time').unbind();
    $('#add-tab-btn').unbind();
    $('#logout-btn').unbind();

    if (g_oConfig.allowRemove) {
        $('.remove-tab-btn').click(_onRemoveClicked);
    }

    if (g_oConfig.allowReload) {
        $('.reload-tab-btn').click(_onReloadClicked);
    }

    if (g_oConfig.allowAdd) {
        $('#add-tab-btn').click(_onAddClicked);
    }

    if (g_oConfig.allowSelect) {
        $('.select-tab-btn').click(_onSelectClicked);
    }

    if (g_oConfig.enableCarousel) {
        $('#carousel-cycle-time').change(_onCarouselCycleTimeChange);
        $('#carousel-start-btn').click(_onCarouselCtrlBtnClicked);
        $('#carousel-stop-btn').click(_onCarouselCtrlBtnClicked);
    }

    if (g_oConfig.enableAutoReload) {
        $('#auto-reload-cycle-time').change(_onAutoReloadCycleTimeChange);
    }

    $('#logout-btn').click(_onLogoutClicked);

    $('#new-tab-url')[0].removeEventListener("keydown", _onNewTabKeyDown);
    $('#new-tab-url')[0].addEventListener("keydown", _onNewTabKeyDown);
}

//======================================================================
function _onNewTabKeyDown(i_oKeyEvent) {
    if (i_oKeyEvent.keyCode === 13) { // enter
        _onAddClicked();
    }
    return true;
}

//======================================================================
function _onCarouselCycleTimeChange(i_oEvent) {
    var l_nValue = Number($("#carousel-cycle-time").val()),
        l_sChromeId = $("#chrome-list").val();

    _sendSocketMsg({
        type: "config",
        chromeId: l_sChromeId,
        config: {
            carouselInterval: l_nValue
        }
    });
}

//======================================================================
function _onAutoReloadCycleTimeChange(i_oEvent) {
    var l_nValue = Number($("#auto-reload-cycle-time").val()),
        l_sChromeId = $("#chrome-list").val();

    _sendSocketMsg({
        type: "config",
        chromeId: l_sChromeId,
        config: {
            autoReloadInterval: l_nValue
        }
    });
}

//======================================================================
function _onLoginClicked() {
    _login()
        .then(_initContent);
}

//======================================================================
function _onLogoutClicked() {
    _logout()
        .then(render);
}

//======================================================================
function _onAddClicked(i_oEvent) {
    var l_sURL = $('#new-tab-url').val().replace(/^\s+|\s+$/g, ""),
        l_sChromeId;

    if (l_sURL) {
        if (g_oSocket && g_oSocket.readyState === WebSocket.OPEN) {
            l_sChromeId = $("#chrome-list").val();
            _sendSocketMsg({
                type: "create",
                chromeId: l_sChromeId,
                tabUrl: l_sURL
            });
        }
    }
}

//======================================================================
function _onRemoveClicked(i_oEvent) {
    var l_oParentNode = i_oEvent.target.parentNode,
        l_sURL = $('.chrome-tab-url', l_oParentNode).html(),
        l_sChromeId;

    if (confirm("remove tab " + l_sURL)) {
        if (g_oSocket && g_oSocket.readyState === WebSocket.OPEN) {
            l_sChromeId = $("#chrome-list").val();
            _sendSocketMsg({
                type: "remove",
                chromeId: l_sChromeId,
                tabId: i_oEvent.target.getAttribute("data-tabid")
            });
        }
    }
}

//======================================================================
function _onReloadClicked(i_oEvent) {
    var l_oParentNode = i_oEvent.target.parentNode,
        l_sURL = $('.chrome-tab-url', l_oParentNode).html(),
        l_sChromeId;

    if (confirm("Reload tab " + l_sURL)) {
        if (g_oSocket && g_oSocket.readyState === WebSocket.OPEN) {
            l_sChromeId = $("#chrome-list").val();
            _sendSocketMsg({
                type: "reload",
                chromeId: l_sChromeId,
                tabId: i_oEvent.target.getAttribute("data-tabid")
            });
        }
    }
}

//======================================================================
function _onSelectClicked(i_oEvent) {
    var l_oParentNode = i_oEvent.target.parentNode,
        l_sURL = $('.chrome-tab-url', l_oParentNode).html(),
        l_sChromeId;

    if (g_oSocket && g_oSocket.readyState === WebSocket.OPEN) {
        l_sChromeId = $("#chrome-list").val();
        _sendSocketMsg({
            type: "select",
            chromeId: l_sChromeId,
            tabId: i_oEvent.target.getAttribute("data-tabid")
        });
    }
}

//======================================================================
function _onCarouselCtrlBtnClicked(i_oEvent) {
    var l_sChromeId,
        l_bRun = /true/i.test(i_oEvent.target.getAttribute("data-run"))

    if (g_oSocket && g_oSocket.readyState === WebSocket.OPEN) {
        l_sChromeId = $("#chrome-list").val();
        _sendSocketMsg({
            type: "toggleCarousel",
            chromeId: l_sChromeId,
            run: l_bRun
        });
    }
}

//======================================================================
function _sendSocketMsg(i_oMsg) {
    var l_oMsg = i_oMsg || {};

    l_oMsg.src = "web";
    l_oMsg.authtoken = g_sAuthToken;
    g_oSocket.send(JSON.stringify(l_oMsg));
}

//======================================================================
function _sendXHR(i_sMethod, i_sURL, i_oBody) {
    return new Promise(i_oResolve => {
        var l_oXHR = new XMLHttpRequest(),
            l_sPBody;

        l_oXHR.open(i_sMethod, i_sURL, true);
        l_oXHR.setRequestHeader("authtoken", g_sAuthToken);
        l_oXHR.onload = function() {
            var l_oData = l_oXHR.responseText;

            if (l_oXHR.responseText) {
                try {
                    l_oData = JSON.parse(l_oData);
                } catch (e) {
                    l_oData = l_oXHR.responseText;
                }
            }

            i_oResolve(l_oData);
        };

        if (i_oBody) {
            l_sPBody = JSON.stringify(i_oBody);
        }

        l_oXHR.send(l_sPBody);
    });
}

//======================================================================
function _connectWebSocket() {
    g_oSocket = new WebSocket("ws://" + window.location.host);

    g_oSocket.onopen = function(e) {
        _sendSocketMsg({
            type: "register"
        });
    };
    // g_oSocket.onclose = function(e) {};
    // g_oSocket.onerror = function(e) {};

    g_oSocket.onmessage = function(data, flags) {
        //  console.log("Web Socket Message received:  ", data, flags);
        // flags.binary will be set if a binary data is received.
        // flags.masked will be set if the data was masked.
        renderContent();
    };
}

//======================================================================
function _isLoggedIn() {
    var l_sAuthToken = g_sAuthToken,
        l_oPromise;

    if (l_sAuthToken) {
        l_oPromise = _sendXHR("POST", "/api/login/validate");
    } else {
        l_oPromise = new Promise(i_oResolve => i_oResolve(false));
    }

    return l_oPromise;
}

//======================================================================
function _login() {
    var l_oPostData = {
        pw: md5($("#login-password").val())
    };

    return _sendXHR("POST", "/api/login", l_oPostData)
        .then(i_sToken => {
            if (i_sToken && typeof(i_sToken) === "string") {
                g_sAuthToken = i_sToken;
                if ($("#login-remember")[0].checked) {
                    localStorage.setItem("authToken", i_sToken);
                }
            }
        });
}

//======================================================================
function _logout() {
    return _sendXHR("POST", "/api/logout").then(() => {
        g_sAuthToken = null;
        localStorage.removeItem("authToken");
        g_oSocket.close();
    });
}

//======================================================================
function _initContent() {
    if (g_sAuthToken) {
        render()
            .then(_connectWebSocket);
    }
}

//======================================================================
function _bootstrap() {
    // 1- login check
    g_sAuthToken = localStorage.getItem("authToken");

    $('#login-password')[0].addEventListener("keydown", i_oKeyEvent => {
        if (i_oKeyEvent.keyCode === 13) { // enter
            _onLoginClicked();
        }
        return true;
    });

    $('#login-btn').click(_onLoginClicked);

    _isLoggedIn().then(i_bIsLoggedIn => {
        if (typeof(i_bIsLoggedIn) === "boolean" && i_bIsLoggedIn) {
            _initContent();
        } else {
            g_sAuthToken = null;
            render();
        }
    })
}

window.onload = _bootstrap;
