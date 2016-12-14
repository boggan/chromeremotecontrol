//======================================================================
function $(i_sId) {
    return document.getElementById(i_sId);
}

//======================================================================
function saveSetting(i_oEvent) {
    var l_sKey,
        l_xValue,
        l_oPayload,
        l_oDOMTarget = i_oEvent.target;

    l_sKey = l_oDOMTarget.getAttribute("data-key");

    if (l_sKey) {
        if (l_oDOMTarget.type === "number") {
            l_xValue = Number(l_oDOMTarget.value);
        } else if (l_oDOMTarget.type === "text") {
            l_xValue = l_oDOMTarget.value;
        } else {
            l_xValue = l_oDOMTarget.checked;
        }

        l_oPayload = {};
        l_oPayload[l_sKey] = l_xValue;

        chrome.storage.sync.set(l_oPayload);
    }
}

//======================================================================
function resetToDefaults() {
    chrome.storage.sync.set(DEFAULT_CONFIG, () => {
        window.location.reload();
    });
}

//======================================================================
function bootstrap() {
    var l_oKeyInputIds = [
            "network-host",
            "network-port",
            "network-reconnect",
            "chk-carousel",
            "carousel-cycle-time",
            "chk-auto-reload",
            "auto-reload-cycle-time",
            "chk-add",
            "chk-remove",
            "chk-reload",
            "chk-select"
        ],
        l_oDataKeyMap = {},
        l_aQuery;

    $('save-btn').addEventListener("click", () => {
        window.focus(); // force blur on fields
        window.close();
    });

    $('reset-btn').addEventListener("click", resetToDefaults);

    l_aQuery = l_oKeyInputIds.map(i_sId => {
        let l_oDOMEl = $(i_sId),
            l_sDataKey = l_oDOMEl.getAttribute("data-key");

        // register events
        if (/number|text/i.test(l_oDOMEl.type)) {
            l_oDOMEl.addEventListener("blur", saveSetting);
        } else {
            l_oDOMEl.addEventListener("change", saveSetting);
        }

        l_oDataKeyMap[l_sDataKey] = l_oDOMEl;

        return l_sDataKey;
    });

    chrome.storage.sync.get(l_aQuery, i_oValues => {
        let l_sDataKey,
            l_oDOMEl;
        for (l_sDataKey in i_oValues) {
            l_oDOMEl = l_oDataKeyMap[l_sDataKey];
            if (l_oDOMEl) {
                if (/text|number/i.test(l_oDOMEl.type)) {
                    l_oDOMEl.value = i_oValues[l_sDataKey];
                } else {
                    l_oDOMEl.checked = Boolean(i_oValues[l_sDataKey]);
                }
            }
        }
    });
}

//======================================================================
// Main Execution
//======================================================================
document.addEventListener('DOMContentLoaded', bootstrap);
