/*
 * Name: NetworkMgr
 * Description: Class used to handle network requests
 * Author: Thomas Lanteigne
 * Date: 17 Oct 2015
 */
var path = require("path"),
    fs = require("fs"),
    md5 = require("md5"),
    restify = require("restify"),
    config = require("../config");

function cNetworkMgr(i_oDashboardApp) {
    //=============================================================================
    // Public methods
    //=============================================================================
    this.startServer = function() {
        console.log("NetworkMgr::startServer::Starting Server...");
        m_oServer = restify.createServer({
            name: 'ChromeRemote'
        });

        // gzip compression
        // m_oServer.use(restify.gzipResponse());
        // query string parser
        //
        m_oServer.use(restify.bodyParser());
        m_oServer.use(restify.queryParser());
        m_oServer.listen(config.network.server_port);

        // handle all file requests, ie: URLs starting with /API/...
        m_oServer.get(/^(?!\/API)/i, _httpFileResponse);

        // handle all API requests, ie: all other URLs
        m_oServer.get(/^\/API\/(\w+)?(?:\/(.*))?/i, _httpAPIResponse);
        m_oServer.post(/^\/API\/(\w+)?(?:\/(.*))?/i, _httpAPIResponse);

        return m_oServer;
    };

    //=============================================================================
    this.getServer = function() {
        return m_oServer;
    }

    //=============================================================================
    this.stopServer = function() {
        // unused for now
    };

    //=============================================================================
    // Private methods
    //=============================================================================

    //=============================================================================
    function _addSalt(i_sString) {
        var i,
            l_sSalted = "";

        for (i = 0; i < i_sString.length; i++) {
            l_sSalted += i_sString[i] + (m_sSalt[i] || "");
        }

        return l_sSalted;
    }

    //=============================================================================
    function _validateAuthToken(i_sAuthToken) {
        return (m_sHashedPw === i_sAuthToken);
    }

    //=============================================================================
    function _login(i_oReq) {
        var l_oPostBody = JSON.parse(i_oReq.body) || {},
            l_sPassword = l_oPostBody.pw,
            l_sToken = _addSalt(l_sPassword);

        if (!_validateAuthToken(l_sToken)) {
            l_sToken = "";
        }

        return l_sToken;
    }

    //=============================================================================
    function _httpAPIResponse(i_oReq, i_oRes, i_oNext) {
        var l_sURL = i_oReq.url.replace(/\/API/i, "").toLowerCase(),
            l_xData,
            l_oMatchData;

        // console.log("API request for ", i_oReq.url);

        if (/login|logout/i.test(l_sURL)) {
            // no need to validate token
            if (l_sURL === "/login") {
                l_xData = _login(i_oReq);
            } else if (l_sURL === "/login/validate") {
                l_xData = _validateAuthToken(i_oReq.headers['authtoken']);
            }
        } else if (_validateAuthToken(i_oReq.headers['authtoken'])) {
            if (l_sURL === "/chrome/list") {
                l_xData = m_oDashboardApp.getChromeList();
            } else {
                l_oMatchData = l_sURL.match(/\/chrome\/([\w\d-]+)\/(tabs\/list|config|carousel\/status)/);
                if (l_oMatchData) {
                    if (l_oMatchData[2] === "config") {
                        l_xData = m_oDashboardApp.getClientConfig(l_oMatchData[1]);
                    } else if (l_oMatchData[2] === "carousel/status") {
                        l_xData = m_oDashboardApp.getCarouselStatus(l_oMatchData[1]);
                    } else {
                        l_xData = m_oDashboardApp.getTabsList(l_oMatchData[1]);
                    }
                }
            }

            if (l_xData === undefined || l_xData === null) {
                l_xData = [];
            }
        }

        _httpResponse(JSON.stringify(l_xData), i_oReq, i_oRes, i_oNext);
    }

    //=============================================================================
    function _httpFileResponse(i_oReq, i_oRes, i_oNext) {

        // console.log("File Request for file ", i_oReq.url);

        var l_sRequestURL = decodeURIComponent(i_oReq.url),
            l_sMsg = "File Request for file " + l_sRequestURL,
            l_sFilePath;

        l_sRequestURL = l_sRequestURL.replace(/\?.*/, ""); // strip out any query string arguments
        if (/\/$/i.test(l_sRequestURL))
            l_sRequestURL += "/index.html";
        else if (/\/favicon.ico/.test(l_sRequestURL))
            l_sRequestURL = "/assets/images/favicon.ico";

        // comic data
        if (/^\/data\/.*?.(jpg|png|gif|cb[zr])/i.test(l_sRequestURL)) {
            l_sFilePath = path.resolve(["./", l_sRequestURL].join('/'));
        } else {
            // regular resource -- client or admin
            // console.log("\n\n\n CLIENT REQUEST ->", l_sRequestURL, "<-\n\n\n");
            l_sFilePath = path.resolve([config.client_web_path, l_sRequestURL].join('/'));
        }

        l_sFilePath = decodeURI(l_sFilePath); // make sure string is decoded
        fs.readFile(l_sFilePath, function(err, i_oData) {
            var l_sExt = path.extname(l_sFilePath);

            if (err) {
                if (!/favicon/i.test(l_sFilePath)) {
                    console.error("NetworkMgr::_httpFileResponse::Error reading file ", l_sFilePath, err);
                }

                i_oReq.url = "404.html";
                _httpFileResponse(i_oReq, i_oRes, i_oNext);
            } else {
                // console.log("File read: ", l_sFilePath, " Extention: ", l_sExt);
                fs.stat(l_sFilePath, function(err, i_oStats) {
                    // console.log("File stat: ", i_oStats);

                    l_sMime = m_oMimeTypes[l_sExt];
                    if (!l_sMime) {
                        l_sMime = m_oMimeTypes.default;
                    }

                    i_oRes.writeHead(200, {
                        'Content-Type': l_sMime,
                        'Content-Length': i_oStats.size, // causes problems with gzip
                        'Server': "Homemade Goodness"
                    });
                    // console.log( "NetworkMgr::_httpFileResponse::Setting mimetype of response to ", l_sMime );
                    if (/^text|javascript/.test(l_sMime)) {
                        l_sMsg = String(i_oData);
                    } else { /* if(/^image\//i.test( l_sMime )) */
                        l_sMsg = i_oData;
                    }

                    _httpResponse(l_sMsg, i_oReq, i_oRes, i_oNext);
                });
            }
        });
    }

    //=============================================================================
    function _httpResponse(i_oMsg, i_oReq, i_oRes, i_oNext) {
        i_oRes.end(i_oMsg);
        return i_oNext();
    }

    //=============================================================================
    // Private Members
    //=============================================================================
    var m_oServer,
        m_sSalt = Math.round(Math.random() * Date.now()).toString(16),
        m_sHashedPw = _addSalt(md5(config.security.password)),
        m_oDashboardApp = i_oDashboardApp,
        m_oMimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.woff': 'application/x-font-woff',
            '.woff2': 'application/x-font-woff2',
            '.ttf': 'application/x-font-ttf',
            '.otf': 'application/x-font-opentype',
            '.eot': 'application/vnd.ms-fontobject',
            '.cbr': 'application/x-cbr', // 'application/octet-stream'
            '.cbz': 'application/x-cbz',
            '.txt': 'text/plain',
            default: 'text/plain'
        };
}

module.exports = cNetworkMgr;
