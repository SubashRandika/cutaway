// The gas in the cylinder, ports and intake runner, drawn on the section plane
// x = 0 in the figure's own camera. Every quantity is a function of crank angle,
// so a slowed cycle crossfades through fresh charge, flame and exhaust smoke.

import { glLayer, glCamera, smooth } from "../../iso/gl.mjs";
import { at } from "./view.mjs";
import { HEAD } from "./view.mjs";
import { P, WIDTH, HEIGHT, RB, DECK, VALVE_TILT, PIN_TO_CROWN, ROOF_APEX } from "./view.mjs";
import { VALVES, liftOf, advanceOf, SLOW } from "./model.mjs";
import { wristZ } from "./frame.mjs";
import { PORTS, RUNNER, PORT_R, RUNNER_R, resample2 } from "./ports.mjs";

const N = 12;
const flat = (points) => resample2(points, N).flat();
const wrap = (deg) => ((deg % 720) + 720) % 720;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const CROWN_BDC = wristZ(180) + PIN_TO_CROWN;
export const INJECTOR = { tip: [18, 133.4], aim: [-0.6, -0.8] };

const FRAGMENT = `
uniform vec2 uIn[${N}];
uniform vec2 uEx[${N}];
uniform vec2 uRun[${N}];
uniform float uCrown;
uniform float uFresh;
uniform float uDense;
uniform float uFlame;
uniform float uFront;
uniform float uBurnt;
uniform float uInFlow;
uniform float uExFlow;
uniform float uInPhase;
uniform float uExPhase;
uniform float uSpray;
uniform float uLight;
uniform vec2 uInjTip;
uniform vec2 uInjAim;
const float RB=${RB.toFixed(2)};
const float DECK=${DECK.toFixed(2)};
const float TANV=${Math.tan(VALVE_TILT).toFixed(4)};
const vec2 GAP=vec2(0.,${(ROOF_APEX - 1.6).toFixed(2)});
const float PR=${PORT_R.toFixed(2)};
const float RR=${RUNNER_R.toFixed(2)};
const float HALF=${HEAD.half.toFixed(2)};

// distance to a polyline and the arc length of the nearest point
vec2 lineDist(vec2 p, vec2 a, vec2 b, float s0){
  vec2 ab=b-a; float t=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.);
  return vec2(length(p-a-ab*t), s0+t*length(ab));
}
#define POLY(NAME,ARR) vec2 NAME(vec2 p){vec2 best=vec2(1e3,0.);float s=0.;for(int i=0;i<${N - 1};i++){vec2 d=lineDist(p,ARR[i],ARR[i+1],s);if(d.x<best.x)best=d;s+=length(ARR[i+1]-ARR[i]);}return best;}
POLY(inPort,uIn)
POLY(exPort,uEx)
POLY(runner,uRun)

vec4 inkFor(vec3 seen,float cover){
  vec3 absorbed=1.-seen;
  float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);
  return vec4(vec3(a)-absorbed,a);
}
vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}

void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf()/uCam.w;
  vec3 w=onWallX(vb,0.);
  vec2 q=w.yz;
  float soft=.9*px;
  if(q.x<-28.||q.x>50.||q.y<uCrown-2.||q.y>153.){gl_FragColor=vec4(0.);return;}

  // where gas can be
  float roof=DECK+(RB-abs(q.x))*TANV;
  float cyl=window(q.x,-RB,RB,soft)*window(q.y,uCrown,roof,soft);
  vec2 di=inPort(q); vec2 de=exPort(q); vec2 dr=runner(q);
  float inside=(1.-smoothstep(PR-soft,PR+soft,di.x))*(1.-smoothstep(HALF-soft,HALF+soft,q.x));
  float exside=(1.-smoothstep(PR-soft,PR+soft,de.x))*smoothstep(-HALF-soft,-HALF+soft,q.x);
  float run=(1.-smoothstep(RR-soft,RR+soft,dr.x))*smoothstep(HALF-soft,HALF+soft,q.x)*(1.-smoothstep(149.5-soft,149.5+soft,q.y));
  if(cyl+inside+exside+run<.001){gl_FragColor=vec4(0.);return;}

  float t=uTime;
  float n=fbm2(q*.32+vec2(t*.07,-t*.05));
  // fresh mixture: a pale blue mist that thickens as it is squeezed
  float fresh=cyl*uFresh*uDense*(.55+.45*n);
  float streakIn=.5+.5*sin(di.y*.9-uInPhase)*(.6+.4*noise2(vec2(di.y*.35-uInPhase*.3,di.x)));
  float streakRun=.5+.5*sin(dr.y*.9-uInPhase)*(.6+.4*noise2(vec2(dr.y*.35-uInPhase*.3,dr.x)));
  fresh+=inside*(.28+.5*uInFlow*streakIn)+run*(.22+.45*uInFlow*streakRun);
  // fuel spray from the injector, a short cone of droplets
  vec2 rel=q-uInjTip; float along=dot(rel,uInjAim); float off=abs(rel.x*uInjAim.y-rel.y*uInjAim.x);
  float cone=smoothstep(0.,1.2,along)*(1.-smoothstep(5.5,9.,along))*(1.-smoothstep(.4+along*.32,.9+along*.42,off));
  float drops=smoothstep(.55,.9,noise2(vec2(along*1.6-t*9.,off*2.2)));
  float spray=uSpray*cone*(.45+.55*drops)*max(run,inside);
  // burnt gas: warm grey smoke, pushed out through the exhaust port
  float streakEx=.5+.5*sin(de.y*.9-uExPhase)*(.6+.4*noise2(vec2(de.y*.35-uExPhase*.3,de.x)));
  float smoke=cyl*uBurnt*(.6+.4*n)+exside*(.22+.6*uExFlow*streakEx);
  // flame: a front spreading from the plug gap, ragged with turbulence
  float r=length(q-GAP);
  float edge=uFront+3.*(fbm2(q*.45+t*.6)-.5);
  float body=cyl*uFlame*(1.-smoothstep(edge-2.5,edge+1.,r));
  float core=body*exp(-r*r/(uFront*uFront*.18+4.))*(.75+.25*n);
  float e=1.-exp(-2.4*(body*.85+core*1.1));

  vec4 ink=vec4(0.);
  if(uLight>.5){
    vec4 freshInk=inkFor(mix(vec3(1.),vec3(.63,.76,.94),clamp(fresh,0.,1.)*.62),0.);
    vec4 sprayInk=inkFor(mix(vec3(1.),vec3(.42,.6,.92),clamp(spray,0.,1.)*.8),0.);
    vec4 smokeInk=inkFor(mix(vec3(1.),vec3(.55,.5,.46),clamp(smoke,0.,1.)*.6),0.);
    vec3 seen=mix(vec3(1.),vec3(1.,.82,.55),smoothstep(0.,.22,e));
    seen=mix(seen,vec3(.98,.47,.08),smoothstep(.12,.5,e));
    seen=mix(seen,vec3(1.,.62,.1),smoothstep(.42,.66,e));
    seen=mix(seen,vec3(1.,.95,.74),smoothstep(.62,.92,e));
    vec4 flameInk=inkFor(seen,.9*smoothstep(.55,.92,e));
    ink=over(flameInk,over(sprayInk,over(smokeInk,freshInk)));
  }else{
    vec3 c=vec3(.25,.38,.6)*fresh*.55+vec3(.35,.55,1.)*spray*.8+vec3(.32,.3,.28)*smoke*.5;
    c+=vec3(1.,.42,.1)*body*1.2+vec3(1.,.85,.55)*core*1.4;
    c=tonemap(c,1.3);
    float a=max(c.r,max(c.g,c.b));
    ink=vec4(c,a);
  }
  ink.rgb=min(ink.rgb,vec3(ink.a));
  float dn=(hash12(gl_FragCoord.xy+fract(t*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(t*.37)*57.)-1.)/255.;
  ink=max(ink+dn*smoothstep(0.,1.5/255.,ink.a),0.);
  gl_FragColor=ink;
}`;

export function gasState(drive, calm = false) {
  const c = drive.angle.crank;
  const w = wrap(c);
  const spark = 360 - advanceOf(drive.rpm);
  const prog = w < spark ? 0 : clamp((w - spark) / 55);
  const crown = wristZ(c) + PIN_TO_CROWN;
  const room = DECK - crown + 2.4;
  const roomBdc = DECK - CROWN_BDC + 2.4;
  const flame = prog > 0 ? smooth(0, 0.22, prog) * Math.exp(-Math.max(0, w - spark - 16) / 40) * (1 - smooth(560, 640, w)) : 0;
  const li = liftOf(c, VALVES.intake);
  const le = liftOf(c, VALVES.exhaust);
  const spray = w > 4 && w < 130 ? Math.sin((Math.PI * (w - 4)) / 126) ** 2 : 0;
  return {
    uCrown: crown,
    uFresh: smooth(0, 150, w) * (1 - prog),
    uDense: clamp(0.32 + 0.68 * Math.pow(roomBdc / room, 0.55) * 0.42, 0, 1),
    uFlame: calm ? Math.min(flame, 0.8) : flame,
    uFront: 2.5 + 22 * Math.pow(prog, 0.75),
    uBurnt: prog * (1 - smooth(500, 716, w)),
    uInFlow: li,
    uExFlow: le,
    uSpray: spray,
  };
}

export function mountGas(canvas) {
  // the theme can change at any time (the header toggle), so it is read every frame
  const themeRoot = canvas.closest(".iso");
  const isLight = () => themeRoot?.getAttribute("data-theme") !== "dark";
  let light = isLight();
  // one layer per canvas: React may mount, unmount and mount again on the same element
  const layer = canvas.__gasLayer ?? glLayer({
    canvas,
    fragment: FRAGMENT,
    view: [WIDTH, HEIGHT],
    camera: glCamera(P),
    uniforms: ["uCrown", "uFresh", "uDense", "uFlame", "uFront", "uBurnt", "uInFlow", "uExFlow", "uInPhase", "uExPhase", "uSpray"],
    fixed: { uIn: flat(PORTS.intake), uEx: flat(PORTS.exhaust), uRun: flat(RUNNER), uLight: light ? 1 : 0, uInjTip: INJECTOR.tip, uInjAim: INJECTOR.aim },
  });
  if (!layer) return { live: false, draw() {}, destroy() {} };
  canvas.__gasLayer = layer;
  canvas.closest(".eng")?.setAttribute("data-gl", "");
  // only the head's box is ever drawn: scissor everything else away
  const corners = [[-28, 66], [50, 66], [50, 153], [-28, 153]].map(([y, z]) => at([0, y, z]));
  const box = [Math.min(...corners.map((p) => p[0])) - 2, Math.min(...corners.map((p) => p[1])) - 2, Math.max(...corners.map((p) => p[0])) + 2, Math.max(...corners.map((p) => p[1])) + 2];
  const gl = layer.gl;
  let clock = 0;
  let last = 0;
  const phase = { inP: 0, exP: 0 };
  return {
    live: true,
    draw(drive, calm = false) {
      const now = performance.now() / 1000;
      const dt = last ? Math.min(now - last, 1 / 30) : 0;
      last = now;
      const s = gasState(drive, calm);
      if (isLight() !== light) {
        light = !light;
        layer.set({ uLight: light ? 1 : 0 });
      }
      if (!calm) {
        clock += dt;
        const speed = drive.rpm * SLOW * 0.9;
        phase.inP += dt * speed * (0.15 + s.uInFlow);
        phase.exP += dt * speed * (0.15 + s.uExFlow);
      }
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      const sx = (Math.round(rect.width * ratio) || 1) / WIDTH;
      const sy = (Math.round(rect.height * ratio) || 1) / HEIGHT;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.floor(box[0] * sx), Math.floor((HEIGHT - box[3]) * sy), Math.ceil((box[2] - box[0]) * sx), Math.ceil((box[3] - box[1]) * sy));
      layer.draw({ ...s, uInPhase: phase.inP, uExPhase: phase.exP }, calm ? 0.8 : clock);
    },
    destroy() {
      layer.clear();
    },
  };
}
