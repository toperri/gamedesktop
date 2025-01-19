fetch("{URL}", {
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
}).then(r => r.text()).then(f => {
    window.electronAPI._fabCallback(f);
});