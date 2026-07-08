import { S } from '@/lib/s';

/* Page d'accès — le site est une préversion privée protégée par mot de passe. */
export default async function AccesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; suite?: string }>;
}) {
  const { err, suite } = await searchParams;
  return (
    <div
      style={S(
        'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(160deg,#0F3053 0%,#0B2239 70%);position:relative;overflow:hidden'
      )}
    >
      <div
        style={S(
          'position:absolute;top:-140px;right:-100px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(79,179,232,0.22),rgba(79,179,232,0) 70%);pointer-events:none'
        )}
      ></div>
      <div
        style={S(
          'position:absolute;bottom:-160px;left:-120px;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(29,130,196,0.18),rgba(29,130,196,0) 70%);pointer-events:none'
        )}
      ></div>

      <div style={S('width:100%;max-width:420px;position:relative')}>
        <div style={S('text-align:center;margin-bottom:26px')}>
          <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:24px;color:#FFFFFF")}>
            Étoile Filante <span style={S('color:#4FB3E8')}>✦</span> L&apos;EDEN
          </div>
          <div style={S('font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#9ED4F2;margin-top:6px')}>
            Promenades en mer · Le Tréport
          </div>
        </div>

        <form
          method="POST"
          action="/api/acces"
          style={S(
            'background:#FFFFFF;border-radius:26px;padding:32px 30px 28px;box-shadow:0 24px 60px rgba(4,16,28,0.45);display:flex;flex-direction:column;gap:16px'
          )}
        >
          <div>
            <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:19px;color:#0B2239")}>
              Site privé
            </div>
            <div style={S('font-size:13.5px;line-height:1.6;color:#5C7893;margin-top:6px')}>
              Cette proposition de site est en accès restreint. Entrez le mot de passe qui vous a été
              communiqué pour embarquer.
            </div>
          </div>
          {err ? (
            <div
              style={S(
                'background:#FBE7E2;border:1px solid #F0C4B9;border-radius:14px;padding:10px 15px;font-size:13px;font-weight:600;color:#C2432E'
              )}
            >
              Mot de passe incorrect · réessayez.
            </div>
          ) : null}
          <input type="hidden" name="suite" value={suite || '/'} />
          <input
            type="password"
            name="password"
            placeholder="Mot de passe"
            autoFocus
            required
            style={S(
              "width:100%;padding:13px 18px;border:1.5px solid #A9D6EF;border-radius:999px;font-size:15px;background:#F7FBFE;color:#0B2239;font-family:'Instrument Sans',sans-serif;outline-color:#1D82C4"
            )}
          />
          <button
            type="submit"
            className="hvBlueBg"
            style={S(
              'cursor:pointer;padding:13px 24px;border-radius:999px;background:#0B2239;color:#FFFFFF;font-weight:700;font-size:14.5px;text-align:center'
            )}
          >
            Entrer →
          </button>
        </form>

        <div style={S('text-align:center;margin-top:18px;font-size:11.5px;color:rgba(158,212,242,0.7);line-height:1.6')}>
          Proposition de site · L&apos;Étoile Filante &amp; L&apos;EDEN
        </div>
      </div>
    </div>
  );
}
