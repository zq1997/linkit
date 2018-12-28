var box = null;
var countUnchecked = null;
var countDirectValid = null;
var countRedirectedValid = null;
var countDirectInvalid = null;
var countRedirectedInvalid = null;
var countException = null;

var responses = [];

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.cmd) {
            case 'makeBox':
                makeBox(request.html);
                break;
            case 'showResult':
                showResult(request.url);
                break;
            default:
                break;
        }
        return true;
    }
);

function makeBox(html) {
    if (box !== null) {
        box.style.visibility = 'visible';
        return;
    }

    var template = document.createElement('template');
    template.innerHTML = html.trim();
    box = template.content.firstChild;
    document.body.appendChild(box);

    countUnchecked = document.getElementById('linkit_count_unchecked');
    countDirectValid = document.getElementById('linkit_count_direct_valid');
    countRedirectedValid = document.getElementById('linkit_count_redirected_valid');
    countDirectInvalid = document.getElementById('linkit_count_direct_invalid');
    countRedirectedInvalid = document.getElementById('linkit_count_redirected_invalid');
    countException = document.getElementById('linkit_count_exception');

    document.getElementById('linkit_start').addEventListener('click', start);
    document.getElementById('linkit_export').addEventListener('click', export_csv);
    document.getElementById('linkit_close').addEventListener('click', function () {
        box.style.visibility = 'hidden';
    });
    box.firstElementChild.onmousedown = function (e) {
        e = e || window.event;
        var x = e.clientX;
        var y = e.clientY;
        document.onmouseup = function () {
            box.style.pointerEvents = 'unset';
            document.onmouseup = null;
            document.onmousemove = null;
        };
        document.onmousemove = function (e) {
            box.style.pointerEvents = 'none';
            e = e || window.event;
            box.style.top = (box.offsetTop + e.clientY - y) + "px";
            box.style.left = (box.offsetLeft + e.clientX - x) + "px";
            box.style.right = 'unset';
            x = e.clientX;
            y = e.clientY;
        };
    }
}

function start() {
    function changeCount(element, delta) {
        var oldCount = parseInt(element.innerHTML);
        var newCount = oldCount + delta;
        element.innerHTML = String(newCount);
        if (oldCount > 0 && newCount <= 0) {
            element.parentElement.style.visibility = 'collapse';
        }
        if (oldCount <= 0 && newCount > 0) {
            element.parentElement.style.visibility = 'inherit';
        }
        return newCount;
    }

    var noCache = document.getElementById("linkit_no_cache").checked;
    var timeout_input = document.getElementById("linkit_timeout");
    var timeout = parseFloat(timeout_input.value);
    timeout = 1 < timeout ? timeout : 1;
    timeout = timeout < 60 ? timeout : 60;
    timeout_input.value = timeout;


    document.querySelectorAll('a[href]:not(.linkit_checked)').forEach(function (link) {
        var url = link.href.split('#')[0];
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return;
        }

        changeCount(countUnchecked, 1);
        link.classList.add('linkit_unchecked');

        chrome.runtime.sendMessage({
            cmd: 'checkUrl',
            url: url,
            noCache: noCache,
            timeout: timeout
        }, function (response) {
            responses.push(response);
            link.classList.remove('linkit_unchecked');
            link.classList.add('linkit_checked');

            if (changeCount(countUnchecked, -1) <= 0) {
                document.getElementById('linkit_export').style.visibility = 'inherit';
            }

            if (response.exception === null) {
                if (response.redirected) {
                    link.classList.add('linkit_redirected');
                }
                if (response.valid) {
                    link.classList.add('linkit_valid');
                    changeCount(response.redirected ? countRedirectedValid : countDirectValid, 1);
                } else {
                    link.classList.add('linkit_invalid');
                    changeCount(response.redirected ? countRedirectedInvalid : countDirectInvalid, 1);
                }
            } else {
                link.classList.add('linkit_exception');
                changeCount(countException, 1);
            }
        });
    });
}

function export_csv() {
    responses.sort(function (a, b) {
        if (a.exception === null && b.exception !== null) {
            return 1;
        } else if (a.exception !== null && b.exception === null) {
            return -1;
        } else if (a.exception !== null && b.exception !== null) {
            return (a.exception < b.exception) ? -1 : 1;
        } else {
            if (a.status !== b.status) {
                return (a.status < b.status) ? -1 : 1;
            } else {
                return (a.requestUrl < b.requestUrl) ? -1 : 1;
            }
        }
    });

    function escapeCsvString(s) {
        return s !== null ? '"' + s.replace('"', '""') + '"' : null;
    }
    var csv = ['exception,status(code),status(text),redirected,valid,requestUrl,responseUrl'];
    responses.forEach(function (r) {
        csv.push([
            r.exception,
            r.status,
            r.statusText,
            r.redirected,
            r.valid,
            escapeCsvString(r.requestUrl),
            escapeCsvString(r.responseUrl)
        ].join(','));
    });
    csv = csv.join('\r\n');

    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', 'linkit.csv');
    element.style.display = 'none';
    box.appendChild(element);
    element.click();
    box.removeChild(element);
}

function showResult(url) {
    url = url.split('#')[0];
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert(url + '\n不是一个合理的URL');
        return;
    }

    var results = [];
    responses.forEach(function (r) {
        if (r.requestUrl === url) {
            for (var i = 0; i < results.length; i++) {
                if (JSON.stringify(r) === JSON.stringify(results[i])) {
                    return;
                }
            }
            results.push(r);
        }
    });

    if (results.length === 0) {
        alert(url + '\n还未进行检查');
    } else {
        str = '请求地址：' + url;
        results.forEach(function (r) {
            str += '\n\n';
            if (r.exception === null) {
                str += r.redirected ? '（重定向的）' : '';
                str += r.valid ? '有效链接' : '无效链接！';
                str += r.redirected ? '\n响应地址：' + r.responseUrl : '';
                str += '\n响应状态：' + r.status + '（' + r.statusText + '）';
            } else {
                str += r.exception;
            }
        });
        alert(str);
    }
}