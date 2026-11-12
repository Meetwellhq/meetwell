'use client'

import { Stage, Phone, Expand, Bar, Avatar, Icon, States, type Act } from '../stageshow/kit'
import './scan-hero.css'

// Meetwell's landing hero: "Share your card with one scan". A phone camera
// frames a printed Meetwell card; iOS finds the QR code (yellow brackets lock
// on, the link pill rises), a tap on the pill opens the card, and the printed
// card grows into the digital one as one object. "Save contact" is tapped and
// becomes "Saved to Contacts" on the same button. The close button folds the
// card back into the print, the scan state resets unseen behind it, and the
// brackets lock on again.
//
// Real strings: meetwell.me (the pill), Lena Ortiz, her role, Save contact /
// Saved to Contacts. Everything else is a bar or the product's mark.
// The QR is real: it opens https://meetwell.me.

type S = { found: boolean; pill: boolean; open: boolean; saved: boolean }

const START: S = { found: false, pill: false, open: false, saved: false }
const REST = { x: 330, y: 470 }

const QR = [
  '1111111011101010101111111', '1000001000010110101000001', '1011101011100010101011101', '1011101000101001001011101',
  '1011101001001001101011101', '1000001001101100101000001', '1111111010101010101111111', '0000000011101111000000000',
  '1010011001010011011000101', '1101000101011110010100100', '1110011000100101000111111', '0010100000011001001010010',
  '0000001110111111000011110', '0011100011011010110110101', '1101111110000011110000111', '0001000001100110100111010',
  '0000101111111101111111111', '0000000000010001100011011', '1111111001101110101010001', '1000001011011101100010110',
  '1011101000110001111111110', '1011101001110011000000101', '1011101010100010000001000', '1000001001000100100111100',
  '1111111011101110011110101',
]

// One path for every dark module: crisp, and a phone can really scan it
const QR_PATH = QR.flatMap((row, y) => [...row].map((c, x) => (c === '1' ? `M${x} ${y}h1v1h-1z` : ''))).join('')

function Code({ size }: { size: number }) {
  return (
    <svg className="mw-qr" viewBox="-1 -1 27 27" width={size} height={size} shapeRendering="crispEdges" aria-hidden>
      <rect x="-1" y="-1" width="27" height="27" fill="#fff" />
      <path d={QR_PATH} fill="#141413" />
    </svg>
  )
}

// Meetwell's own mark, from meetwell.me
function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="#1f4d3f" />
      <rect x="6" y="6" width="5" height="5" rx="1.5" fill="#fff" />
      <rect x="13" y="13" width="5" height="5" rx="1.5" fill="#fff" />
      <rect x="13" y="6" width="5" height="5" rx="2.5" fill="#9aafa9" />
      <rect x="6" y="13" width="5" height="5" rx="2.5" fill="#9aafa9" />
    </svg>
  )
}

// The printed card: what the camera sees, and the face the digital card grows from
function Printed() {
  return (
    <div className="mw-print">
      <div className="mw-print__who">
        <Mark size={20} />
        <span className="mw-print__name">Lena Ortiz</span>
        <Bar w={92} h={6} r={3} className="mw-print__bar" />
      </div>
      <span className="mw-print__code">
        <Code size={104} />
      </span>
    </div>
  )
}

const script = async (a: Act<S>) => {
  await a.wait(500)
  a.mark('found')
  a.put({ found: true })
  await a.wait(450)
  a.put({ pill: true })
  await a.wait(1300)
  a.mark('tap')
  await a.click('pill')
  a.put({ open: true })
  await a.wait(1700)
  a.mark('save')
  await a.click({ at: 'save', x: 0.8, y: 0.55 })
  a.put({ saved: true })
  await a.wait(2400)
  a.mark('close')
  await a.click('close')
  // Closing drops the scan with it: the pill and brackets are under the card
  a.put({ open: false, found: false, pill: false })
  await a.wait(650)
  // Folded back into the print now: the button resets unseen
  await a.snap({ saved: false })
  await a.move(REST)
}

export function ScanHero() {
  return (
    <Stage<S>
      width={440}
      height={540}
      compact={{ below: 440, width: 358, height: 500 }}
      initial={START}
      poster={{ found: false, pill: false, open: true, saved: true }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="mw"
    >
      {(s, rect, layout) => (
        <>
          <div className="mw-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="mw-phone" dark={!s.open}>
            {/* The camera feed: a dim table, the card in focus */}
            <div className="mw-feed">
              <div className="mw-feed__blur" />
              <div className="mw-print-slot" data-target="card">
                <Printed />
              </div>
            </div>

            {/* The digital card: the same object as the print, grown to the screen */}
            <div className="mw-layer" data-open={s.open || undefined}>
              <Expand open={s.open} from={rect('card')} radius={14} duration={640} face={<Printed />} className="mw-expand">
                <div className="mw-page">
                  <div className="mw-hero">
                    <span className="mw-close" data-target="close">
                      <Icon name="close" size={16} stroke={2.25} />
                    </span>
                    <Avatar name="Lena Ortiz" size={76} tone="accent" className="mw-avatar" />
                    <span className="mw-name">Lena Ortiz</span>
                    <span className="mw-role">Brand designer at Northfield</span>
                    <span className="mw-made">
                      <Mark size={16} />
                      <Bar w={84} h={6} r={3} className="mw-made__bar" />
                    </span>
                  </div>
                  <div className="mw-body">
                    <span className="mw-save" data-target="save" data-saved={s.saved || undefined}>
                      <States
                        value={s.saved ? 'saved' : 'save'}
                        states={{
                          save: (
                            <span className="mw-save__label">
                              <Icon name="user" size={18} filled />
                              Save contact
                            </span>
                          ),
                          saved: (
                            <span className="mw-save__label">
                              <Icon name="check" size={18} filled />
                              Saved to Contacts
                            </span>
                          ),
                        }}
                      />
                    </span>
                    <div className="mw-rows">
                      {(['mail', 'send', 'calendar', 'globe'] as const).map((icon, i) => (
                        <span key={icon} className="mw-row">
                          <span className="mw-row__icon">
                            <Icon name={icon} size={16} filled={icon !== 'globe'} stroke={2} />
                          </span>
                          <span className="mw-row__text">
                            <Bar w={[54, 44, 60, 40][i]!} h={6} r={3} tone={2} />
                            <Bar w={[150, 118, 136, 104][i]!} h={8} r={4} tone={4} />
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Expand>
            </div>

            {/* What iOS draws over the feed once it reads the code; it goes as the card opens */}
            <div className="mw-scan" data-open={s.open || undefined}>
              <div className="mw-brackets" data-on={s.found || undefined}>
                {['tl', 'tr', 'bl', 'br'].map((c) => (
                  <span key={c} className="mw-bracket" data-c={c} />
                ))}
              </div>
              <span className="mw-pill" data-target="pill" data-show={s.pill || undefined}>
                <Icon name="globe" size={16} stroke={2} />
                meetwell.me
              </span>
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
