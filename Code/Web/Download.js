// what html element is event coming from?
var element = document.getElementById(id);

var downloadLink = window[id];

element.style.color = 'gray';

element.href = 'javascript:void(0)';

var base = element.innerHTML.replace('<span>Download</span>', '<span>$MSG$</span>');

element.innerHTML = base.replace('$MSG$', 'Downloading...');

var xhr = new XMLHttpRequest();
xhr.open('GET', downloadLink, true);
xhr.responseType = 'blob';

xhr.onprogress = function(event) {
    if (event.lengthComputable) {
        var percentComplete = (event.loaded / event.total) * 100;
        element.innerHTML = base.replace('$MSG$', `Downloading... ${Math.round(percentComplete)}%`);
    }
};

xhr.onload = function() {
    if (xhr.status === 200) {
        var url = window.URL.createObjectURL(xhr.response);
        var a = document.createElement('a');
        a.href = url;
        a.download = downloadLink.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        element.innerHTML = base.replace('$MSG$', 'Download is complete');
    } else {
        element.innerHTML = base.replace('$MSG$', 'Download failed');
    }
};

xhr.onerror = function() {
    element.innerHTML = base.replace('$MSG$', 'Download failed');
};

xhr.send();