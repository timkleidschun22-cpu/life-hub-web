(() => {
  'use strict';

  const VERSION = 'V0.4.7';
  const PROJECT_REF = 'msbukmpggridfnpovrxw';
  const SUPABASE_URL = 'https://msbukmpggridfnpovrxw.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_T3jeEErOKywU3h4MnTowrQ_L2oAF3pd';
  const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
  const RELOAD_GUARD = 'life-hub-v047-proposal-reload';
  let pendingProposalCount = null;

  function getAccessToken() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed?.access_token === 'string'
        ? parsed.access_token
        : typeof parsed?.currentSession?.access_token === 'string'
          ? parsed.currentSession.access_token
          : null;
    } catch {
      return null;
    }
  }

  async function supabaseFetch(path, accessToken, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('apikey', PUBLISHABLE_KEY);
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Life Hub request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`);
    }

    return response;
  }

  async function safeModeEnabled(accessToken) {
    const response = await supabaseFetch(
      '/rest/v1/life_entities?id=eq.system%3Apreference%3Asafe-mode&select=attributes&limit=1',
      accessToken
    );
    const rows = await response.json();
    return rows?.[0]?.attributes?.enabled === true;
  }

  async function listPendingProposals(accessToken) {
    const response = await supabaseFetch(
      '/rest/v1/life_ai_proposals?status=eq.pending&select=event_id,action,result_key,payload,status&order=created_at.asc&limit=4',
      accessToken
    );
    return await response.json();
  }

  async function applyProposal(accessToken, proposal) {
    const body = {
      action: proposal.action,
      eventId: proposal.event_id,
      [proposal.result_key]: proposal.payload,
    };

    await supabaseFetch('/functions/v1/lifehub-agent', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const timestamp = new Date().toISOString();
    await supabaseFetch(
      `/rest/v1/life_ai_proposals?event_id=eq.${encodeURIComponent(proposal.event_id)}&status=eq.pending`,
      accessToken,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'applied',
          applied_at: timestamp,
          updated_at: timestamp,
          last_error: null,
        }),
      }
    );
  }

  async function markProposalError(accessToken, proposal, error) {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    try {
      await supabaseFetch(
        `/rest/v1/life_ai_proposals?event_id=eq.${encodeURIComponent(proposal.event_id)}&status=eq.pending`,
        accessToken,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'error',
            updated_at: timestamp,
            last_error: message.slice(0, 1000),
          }),
        }
      );
    } catch {
      // Keep the original failure as the authoritative error.
    }
  }

  function patchTextLeaf(element, matcher, replacement) {
    if (element.children.length !== 0) return;
    const text = element.textContent || '';
    if (matcher.test(text)) element.textContent = text.replace(matcher, replacement);
  }

  function refreshUi() {
    for (const element of document.querySelectorAll('div,span,p')) {
      patchTextLeaf(element, /LIFE HUB · V0\.4\.4/g, VERSION);
      patchTextLeaf(
        element,
        /Der portable Core und Supabase Cloud sind aktiv\. Neue Goals, Captures und Quest-Fortschritte werden jetzt Core-first erfasst; AI-Orchestrierung und Obsidian folgen darauf\./g,
        'Der portable Core, Supabase Cloud, AI-Queue, ChatGPT Auto Worker und Obsidian-Projektionen sind aktiv. ChatGPT kann Arbeit im Hintergrund vorbereiten; die angemeldete App validiert und übernimmt staged Proposals automatisch.'
      );
      patchTextLeaf(
        element,
        /Autonomie freigegeben: Verarbeitungsschicht kann später sicher darauf aufbauen\./g,
        'Auto Worker aktiv: ChatGPT erzeugt staged Proposals. Kanonische Änderungen laufen weiterhin durch die Life-Hub-Validierung.'
      );
      patchTextLeaf(
        element,
        /Safe Mode: autonome Verarbeitung muss pausieren\./g,
        'Safe Mode: automatische Proposal-Erstellung und -Übernahme pausieren.'
      );

      if (element.children.length === 0) {
        const text = element.textContent || '';
        const match = text.match(/^(\d+) Vorgänge warten auf AI-Verarbeitung$/);
        if (match) {
          element.textContent = pendingProposalCount === null
            ? `${match[1]} Core-Vorgänge`
            : `${match[1]} Core-Vorgänge · ${pendingProposalCount} AI-Proposals bereit`;
        }
      }
    }
  }

  const observer = new MutationObserver(() => refreshUi());
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  refreshUi();

  async function run() {
    const accessToken = getAccessToken();
    if (!accessToken) return;

    if (await safeModeEnabled(accessToken)) {
      pendingProposalCount = 0;
      refreshUi();
      return;
    }

    const proposals = await listPendingProposals(accessToken);
    pendingProposalCount = Array.isArray(proposals) ? proposals.length : 0;
    refreshUi();

    let applied = 0;
    for (const proposal of proposals || []) {
      try {
        await applyProposal(accessToken, proposal);
        applied += 1;
      } catch (error) {
        await markProposalError(accessToken, proposal, error);
      }
    }

    if (applied > 0 && sessionStorage.getItem(RELOAD_GUARD) !== '1') {
      sessionStorage.setItem(RELOAD_GUARD, '1');
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }

    if (applied === 0) sessionStorage.removeItem(RELOAD_GUARD);
  }

  window.setTimeout(() => {
    run().catch(() => {
      // The core app remains usable if the proposal bridge is temporarily unavailable.
    });
  }, 700);
})();
