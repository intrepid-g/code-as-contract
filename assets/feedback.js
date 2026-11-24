// Feedback tab, vertical, center right. Adapted from ../everything feedback_widget.js.
// ponytail: static pages have no backend to hold a GitHub token, so submit opens a
// prefilled GitHub issue form; the form template applies the labels. Upgrade path:
// a small server endpoint (like everything/feedback) that creates the issue via the API.
(function () {
  var REPO = "https://github.com/intrepid-g/code-as-contract";
  var TEMPLATE = { Bug: "feedback-bug.yml", Improvement: "feedback-improvement.yml" };
  var MAX_SUMMARY = 200, MAX_DESC = 4000; // keeps the URL well under GitHub's ~8 KB limit

  function issueUrl(kind, summary, description, page) {
    var p = new URLSearchParams({
      template: TEMPLATE[kind], title: summary.trim().slice(0, MAX_SUMMARY),
      description: description.trim().slice(0, MAX_DESC), page: page.split("#")[0]
    });
    return REPO + "/issues/new?" + p.toString();
  }
  if (typeof document === "undefined") { module.exports = { issueUrl: issueUrl, TEMPLATE: TEMPLATE }; return; }

  var CSS =
    "#fbw{--a:var(--seal,#93312E);--bg:var(--paper-raised,#fff);--fg:var(--ink,#1B222C);--rule:var(--rule,#D6D9D2);font-family:inherit}" +
    "#fbw [hidden]{display:none!important}" +
    "#fbw-tab{position:fixed;right:0;top:50%;transform:translateY(-50%) rotate(180deg);writing-mode:vertical-rl;text-transform:uppercase;letter-spacing:.08em;font:bold 12px/1 inherit;padding:14px 5px;background:var(--a);color:#fff;border:0;border-radius:0 6px 6px 0;cursor:pointer;z-index:1000}" +
    "#fbw-tab:focus-visible,#fbw-panel :focus-visible{outline:2px solid var(--a);outline-offset:2px}" +
    "#fbw-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000}" +
    "#fbw-panel{position:fixed;right:0;top:50%;transform:translateY(-50%);width:360px;max-width:100vw;max-height:90vh;overflow:auto;box-sizing:border-box;padding:16px;background:var(--bg);color:var(--fg);border:1px solid var(--rule);border-radius:8px 0 0 8px;box-shadow:-4px 0 20px rgba(0,0,0,.3);z-index:1001}" +
    "#fbw-head{display:flex;justify-content:space-between;align-items:center}#fbw-head h2{margin:0;font-size:18px}" +
    "#fbw-close{background:none;border:0;color:inherit;font-size:22px;cursor:pointer}" +
    "#fbw label{display:block;margin:12px 0 4px;font-size:13px;font-weight:600}" +
    "#fbw input,#fbw select,#fbw textarea{width:100%;box-sizing:border-box;padding:8px;font:inherit;font-size:14px;color:inherit;background:transparent;border:1px solid var(--rule);border-radius:4px}" +
    "#fbw select option{color:#000}" +
    "#fbw-submit{margin-top:14px;padding:8px 14px;background:var(--a);color:#fff;border:0;border-radius:4px;font:inherit;cursor:pointer}" +
    "#fbw-note{font-size:12px;opacity:.75;margin:10px 0 0}";

  function boot() {
    var style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    var root = document.createElement("div"); root.id = "fbw";
    root.innerHTML =
      '<button type="button" id="fbw-tab" aria-haspopup="dialog" aria-expanded="false" aria-controls="fbw-panel">Feedback</button>' +
      '<div id="fbw-backdrop" hidden></div>' +
      '<div id="fbw-panel" role="dialog" aria-modal="true" aria-labelledby="fbw-heading" hidden>' +
      '<div id="fbw-head"><h2 id="fbw-heading">Send feedback</h2><button type="button" id="fbw-close" aria-label="Close">&times;</button></div>' +
      '<form id="fbw-form"><label for="fbw-title">Summary</label>' +
      '<input id="fbw-title" maxlength="' + MAX_SUMMARY + '" required placeholder="Short summary of the issue or idea">' +
      '<label for="fbw-type">Type</label><select id="fbw-type"><option>Bug</option><option>Improvement</option></select>' +
      '<label for="fbw-desc">Description</label>' +
      '<textarea id="fbw-desc" rows="5" maxlength="' + MAX_DESC + '" placeholder="Steps to reproduce, or details about the idea"></textarea>' +
      '<button type="submit" id="fbw-submit">Continue on GitHub</button>' +
      '<p id="fbw-note">Opens a prefilled GitHub issue. You need a GitHub account to submit it.</p></form></div>';
    document.body.appendChild(root);
    function q(id) { return root.querySelector("#fbw-" + id); }
    var tab = q("tab"), panel = q("panel"), backdrop = q("backdrop"), title = q("title");
    function toggle(open) {
      panel.hidden = backdrop.hidden = !open; tab.hidden = open;
      tab.setAttribute("aria-expanded", open);
      (open ? title : tab).focus();
    }
    tab.onclick = function () { toggle(true); };
    q("close").onclick = backdrop.onclick = function () { toggle(false); };
    document.addEventListener("keydown", function (e) {
      if (panel.hidden) return;
      if (e.key === "Escape") return toggle(false);
      if (e.key !== "Tab") return;
      var f = panel.querySelectorAll("button,input,select,textarea"), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    q("form").onsubmit = function (e) {
      e.preventDefault();
      window.open(issueUrl(q("type").value, title.value, q("desc").value, location.href), "_blank", "noopener");
      title.value = q("desc").value = ""; toggle(false);
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
