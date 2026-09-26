import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const COMPONENTS = [
  { id:"cam_top",    label:"Top Camera",         color:0x00d4ff, type:"camera"   },
  { id:"cam_sideL",  label:"Side Camera (Left)",  color:0x00d4ff, type:"camera"   },
  { id:"cam_sideR",  label:"Side Camera (Right)", color:0x00d4ff, type:"camera"   },
  { id:"cam_front",  label:"Front Camera",        color:0x00d4ff, type:"camera"   },
  { id:"led_ceil",   label:"LED Panel (Ceiling)", color:0xffcc00, type:"light"    },
  { id:"led_sideL",  label:"LED Strip (Left)",    color:0xffcc00, type:"light"    },
  { id:"led_sideR",  label:"LED Strip (Right)",   color:0xffcc00, type:"light"    },
  { id:"ir_entry",   label:"IR Beam — Entry",     color:0xff3333, type:"sensor"   },
  { id:"ir_exit",    label:"IR Beam — Exit",      color:0xff3333, type:"sensor"   },
  { id:"wire_L",     label:"Wiring Conduit (L)",  color:0xff9900, type:"wiring"   },
  { id:"wire_R",     label:"Wiring Conduit (R)",  color:0xff9900, type:"wiring"   },
  { id:"wire_ceil",  label:"Wiring Conduit (Top)",color:0xff9900, type:"wiring"   },
  { id:"panel",      label:"Work Panel (Top Lid)",color:0x88aaff, type:"panel"    },
  { id:"raspberry",  label:"Raspberry Pi 5",      color:0xff6b9d, type:"hardware" },
  { id:"psu",        label:"Power Supply Unit",   color:0xaaaaaa, type:"hardware" },
];

const TYPE_COLORS = {
  camera:"#00d4ff", light:"#ffcc00", sensor:"#ff3333",
  wiring:"#ff9900", panel:"#88aaff", hardware:"#ff6b9d"
};

export default function TunnelPlatform() {
  const mountRef  = useRef(null);
  const stateRef  = useRef({ panelOpen:false, showWiring:true, rotate:true });
  const [ui, setUi]         = useState({ panelOpen:false, showWiring:true, rotate:true });
  const [hovered, setHov]   = useState(null);

  useEffect(() => {
    const el = mountRef.current;
    const W = el.clientWidth, H = el.clientHeight;

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.FogExp2(0x080c14, 0.10);

    const cam3d = new THREE.PerspectiveCamera(44, W/H, 0.01, 100);
    let theta = 0.55, phi = 0.62, radius = 7.0;
    const syncCam = () => {
      cam3d.position.set(
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.sin(phi),
        radius * Math.cos(theta) * Math.cos(phi)
      );
      cam3d.lookAt(0, 0.6, 0);
    };
    syncCam();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 8, 4); sun.castShadow = true; scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8899cc, 0.4);
    rim.position.set(-4, 2, -5); scene.add(rim);

    // Ground
    const grid = new THREE.GridHelper(14, 28, 0x1a2a3a, 0x0f1a24);
    grid.position.y = -0.02; scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);
    const meshMap = {};

    // ── TUNNEL DIMENSIONS ─────────────────────────────────────────
    // Real: 80cm long × 50cm wide × 60cm tall walkway
    // Work panel on top: 20cm tall
    // BOTH ends are OPEN — it is a tunnel
    const TL = 1.6;   // tunnel length  (80 cm)
    const TW = 1.0;   // tunnel width   (50 cm)
    const TH = 1.2;   // tunnel height  (60 cm)
    const PH = 0.4;   // panel height   (20 cm)
    const hl = TL/2, hw = TW/2;

    // ── MATERIALS ─────────────────────────────────────────────────
    const mkMat = (color, opts={}) =>
      new THREE.MeshPhongMaterial({ color, ...opts });

    const wallMat  = mkMat(0xeef2f6, { transparent:true, opacity:0.45, side:THREE.DoubleSide });
    const solidMat = mkMat(0xeef2f6, { side:THREE.DoubleSide });
    const floorMat = mkMat(0xdde5e0);
    const panMat   = mkMat(0xccd6e8, { transparent:true, opacity:0.88 });
    const camMat   = mkMat(0x1a1a1a, { shininess:140 });
    const lensMat  = mkMat(0x080808, { emissive:0x001a66, shininess:220 });
    const ledMat   = new THREE.MeshBasicMaterial({ color:0xffffaa });
    const ledGlow  = new THREE.MeshBasicMaterial({ color:0xffee88, transparent:true, opacity:0.13 });
    const wireMat  = mkMat(0xff8800, { emissive:0x221100 });
    const irMat    = new THREE.MeshBasicMaterial({ color:0xff1111, transparent:true, opacity:0.6 });
    const hwMat    = mkMat(0xff6b9d, { emissive:0x220010, shininess:80 });
    const psuMat   = mkMat(0x888888, { shininess:60 });

    function addEdge(geo, parent, color=0x6699bb, op=0.55) {
      const l = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color, transparent:true, opacity:op })
      );
      parent.add(l);
    }

    // ── FLOOR ─────────────────────────────────────────────────────
    const flGeo  = new THREE.BoxGeometry(TL, 0.05, TW);
    const flMesh = new THREE.Mesh(flGeo, floorMat);
    flMesh.position.set(0, 0.025, 0); flMesh.receiveShadow = true;
    root.add(flMesh); addEdge(flGeo, flMesh);

    // ── TWO SIDE WALLS (left & right along tunnel length) ─────────
    // These are the long walls running front-to-back
    const swGeo = new THREE.BoxGeometry(TL, TH, 0.04);
    [-hw, hw].forEach(z => {
      const sw = new THREE.Mesh(swGeo, wallMat.clone());
      sw.position.set(0, TH/2, z);
      root.add(sw); addEdge(swGeo, sw);
    });

    // ── CEILING ───────────────────────────────────────────────────
    const ceilGeo  = new THREE.BoxGeometry(TL, 0.04, TW);
    const ceilMesh = new THREE.Mesh(ceilGeo, wallMat.clone());
    ceilMesh.position.set(0, TH, 0);
    root.add(ceilMesh); addEdge(ceilGeo, ceilMesh);

    // ── NO FRONT OR BACK WALLS — it is a tunnel! ──────────────────
    // Just entry/exit arches to frame the openings

    // Entry arch frame (green) — at x = -hl
    const archMat = new THREE.MeshPhongMaterial({ color:0x00cc55, emissive:0x003311 });
    function makeArch(x, color) {
      const am = new THREE.MeshPhongMaterial({ color, emissive:0x001108 });
      // Top bar
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, TW+0.06), am);
      top.position.set(x, TH+0.03, 0); root.add(top);
      // Side pillars
      [-hw, hw].forEach(z => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, TH+0.06, 0.06), am);
        p.position.set(x, TH/2, z); root.add(p);
      });
    }
    makeArch(-hl, 0x00cc55); // Entry — GREEN
    makeArch( hl, 0xff5533); // Exit  — RED/ORANGE

    // Entry label sign
    const entrySign = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.22, 0.38),
      new THREE.MeshPhongMaterial({ color:0x00aa44, emissive:0x002211 })
    );
    entrySign.position.set(-hl-0.04, TH+0.14, 0);
    root.add(entrySign);

    // Exit label sign
    const exitSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.22, 0.38),
      new THREE.MeshPhongMaterial({ color:0xff4422, emissive:0x220800 })
    );
    exitSign.position.set(hl+0.04, TH+0.14, 0);
    root.add(exitSign);

    // Chicken walk arrow (floor center strip)
    for(let i=0; i<4; i++){
      const arrow = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.005, 0.07),
        new THREE.MeshBasicMaterial({ color:0x00cc55, transparent:true, opacity:0.5 })
      );
      arrow.position.set(-hl+0.25 + i*0.36, 0.053, 0);
      root.add(arrow);
    }

    // ── WORK PANEL (hinged top section) ───────────────────────────
    const panGroup = new THREE.Group();
    panGroup.position.set(0, TH, 0);
    root.add(panGroup);

    const panGeo = new THREE.BoxGeometry(TL, PH, TW);
    const panMesh = new THREE.Mesh(panGeo, panMat);
    panMesh.position.set(0, PH/2, 0);
    panGroup.add(panMesh); addEdge(panGeo, panMesh);
    meshMap["panel"] = panMesh;

    // Blue seam line between panel and box
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(TL+0.02, 0.02, TW+0.02),
      new THREE.MeshBasicMaterial({ color:0x4488ff, transparent:true, opacity:0.8 })
    );
    seam.position.set(0, 0.01, 0); panGroup.add(seam);

    // Hinge detail (back side)
    for(let i=-1;i<=1;i++){
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03,0.03,0.06,8),
        new THREE.MeshPhongMaterial({ color:0x555566 })
      );
      hinge.rotation.z = Math.PI/2;
      hinge.position.set(i*0.5, 0, -hw);
      panGroup.add(hinge);
    }

    // Raspberry Pi inside panel
    const rpiGeo = new THREE.BoxGeometry(0.18, 0.03, 0.12);
    const rpi = new THREE.Mesh(rpiGeo, hwMat.clone());
    rpi.position.set(-0.38, PH/2+0.015, -0.12);
    panGroup.add(rpi); addEdge(rpiGeo, rpi); meshMap["raspberry"] = rpi;
    for(let i=0;i<4;i++){
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.005,0.02,4),
        new THREE.MeshBasicMaterial({color:0xffcc00}));
      pin.position.set(-0.38+i*0.03-0.045, PH/2+0.036, -0.12);
      panGroup.add(pin);
    }

    // PSU
    const psuGeo = new THREE.BoxGeometry(0.28, 0.07, 0.14);
    const psu = new THREE.Mesh(psuGeo, psuMat.clone());
    psu.position.set(0.38, PH/2+0.035, 0.1);
    panGroup.add(psu); addEdge(psuGeo, psu); meshMap["psu"] = psu;

    // ── CAMERAS ───────────────────────────────────────────────────
    function makeCamera(pos, ry, rx, id) {
      const cg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.065,0.045), camMat.clone());
      cg.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.04,12), lensMat.clone());
      lens.rotation.x = Math.PI/2; lens.position.z = 0.042; cg.add(lens);
      const shine = new THREE.Mesh(new THREE.CircleGeometry(0.01,8),
        new THREE.MeshBasicMaterial({ color:0x88ccff }));
      shine.position.z = 0.063; cg.add(shine);
      const bkt = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.1,0.025),
        new THREE.MeshPhongMaterial({color:0x333333}));
      bkt.position.set(0,-0.075,0); cg.add(bkt);
      // FOV cone
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.25,0.5,8,1,true),
        new THREE.MeshBasicMaterial({color:0x00d4ff, transparent:true, opacity:0.055, side:THREE.DoubleSide})
      );
      cone.rotation.x = -Math.PI/2; cone.position.z = 0.28; cg.add(cone);
      cg.position.set(...pos);
      cg.rotation.set(rx||0, ry||0, 0);
      root.add(cg); meshMap[id] = cg;
    }

    // TOP CAMERA — center of ceiling pointing straight down
    const topCG = new THREE.Group();
    const tcB = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.045,0.065), camMat.clone());
    topCG.add(tcB);
    const tcL = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.04,12), lensMat.clone());
    tcL.position.y = -0.042; topCG.add(tcL);
    const tcS = new THREE.Mesh(new THREE.CircleGeometry(0.01,8),
      new THREE.MeshBasicMaterial({color:0x88ccff}));
    tcS.rotation.x = Math.PI/2; tcS.position.y = -0.064; topCG.add(tcS);
    // Downward FOV cone
    const tcCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.38,0.6,8,1,true),
      new THREE.MeshBasicMaterial({color:0x00d4ff, transparent:true, opacity:0.05, side:THREE.DoubleSide})
    );
    tcCone.position.y = -0.32; topCG.add(tcCone);
    topCG.position.set(0, TH-0.04, 0);
    root.add(topCG); meshMap["cam_top"] = topCG;

    // SIDE CAM LEFT — on back wall (-Z), pointing into tunnel (+Z)
    makeCamera([0, TH*0.52, -hw+0.045],  0, 0, "cam_sideL");
    // SIDE CAM RIGHT — on front wall (+Z), pointing into tunnel (-Z)
    makeCamera([0, TH*0.52,  hw-0.045], Math.PI, 0, "cam_sideR");
    // FRONT CAMERA — mounted just inside entry arch, above, angled down 25°
    makeCamera([-hl+0.06, TH*0.85, 0], 0, 0.44, "cam_front");

    // ── LED LIGHTING ──────────────────────────────────────────────
    // Ceiling panel
    const lcG = new THREE.BoxGeometry(TL*0.78, 0.02, TW*0.55);
    const lcM = new THREE.Mesh(lcG, ledMat.clone());
    lcM.position.set(0, TH-0.03, 0); root.add(lcM);
    const lcGl = new THREE.Mesh(new THREE.PlaneGeometry(TL*0.78, TW*0.55),
      ledGlow.clone());
    lcGl.rotation.x = Math.PI/2; lcGl.position.set(0, TH-0.055, 0); root.add(lcGl);
    meshMap["led_ceil"] = lcM;

    // Side LED strips on the two long walls
    [{z:-hw+0.05, id:"led_sideL", nx:1}, {z:hw-0.05, id:"led_sideR", nx:-1}].forEach(({z,id,nx})=>{
      const sg = new THREE.BoxGeometry(TL*0.82, 0.018, 0.05);
      const sm = new THREE.Mesh(sg, ledMat.clone());
      sm.position.set(0, TH*0.74, z); root.add(sm);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(TL*0.82, 0.28),
        ledGlow.clone());
      gl.rotation.y = nx*Math.PI/2; gl.position.set(0, TH*0.74, z+nx*0.1); root.add(gl);
      meshMap[id] = sm;
    });

    // ── IR BEAM SENSORS ───────────────────────────────────────────
    function makeIR(x, id) {
      const mat = new THREE.MeshPhongMaterial({color:0xcc0000, emissive:0x440000});
      // Emitter on back wall
      const em = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.07,8), mat.clone());
      em.rotation.z = Math.PI/2; em.position.set(x, TH*0.38, -hw+0.045); root.add(em);
      // Receiver on front wall
      const rc = em.clone(); rc.position.set(x, TH*0.38, hw-0.045); root.add(rc);
      // Beam line
      const pts = [new THREE.Vector3(x,TH*0.38,-hw+0.08), new THREE.Vector3(x,TH*0.38,hw-0.08)];
      const beam = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:0xff1111, transparent:true, opacity:0.65})
      );
      root.add(beam); meshMap[id] = beam;
    }
    makeIR(-hl+0.22, "ir_entry");
    makeIR( hl-0.22, "ir_exit");

    // ── WIRING CONDUITS ───────────────────────────────────────────
    function conduit(pts, id) {
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 6, false),
        wireMat.clone()
      );
      root.add(mesh); meshMap[id] = mesh;
    }
    // Left wall conduit (runs along back wall corner, up to panel)
    conduit([
      new THREE.Vector3(-hl+0.06, 0.1,   -hw+0.07),
      new THREE.Vector3(-hl+0.06, TH*0.5,-hw+0.07),
      new THREE.Vector3(-hl+0.06, TH,    -hw+0.07),
    ], "wire_L");
    // Right wall conduit
    conduit([
      new THREE.Vector3( hl-0.06, 0.1,   -hw+0.07),
      new THREE.Vector3( hl-0.06, TH*0.5,-hw+0.07),
      new THREE.Vector3( hl-0.06, TH,    -hw+0.07),
    ], "wire_R");
    // Ceiling conduit connects left to right
    conduit([
      new THREE.Vector3(-hl+0.06, TH-0.03, -hw+0.07),
      new THREE.Vector3(0,        TH-0.03, -hw+0.07),
      new THREE.Vector3( hl-0.06, TH-0.03, -hw+0.07),
    ], "wire_ceil");

    // ── DIMENSION LINES ───────────────────────────────────────────
    const dMat = new THREE.LineBasicMaterial({color:0x3a5577, transparent:true, opacity:0.5});
    [ [[-hl,-0.12, hw+0.18],[hl,-0.12, hw+0.18]],
      [[hl+0.14,-0.12,-hw], [hl+0.14,-0.12,hw]],
      [[hl+0.14,0,-hw],     [hl+0.14,TH+PH,-hw]] ].forEach(([p1,p2])=>{
      const ln = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1),new THREE.Vector3(...p2)]),
        dMat.clone()
      );
      scene.add(ln);
    });
    // Tick marks
    [ [[-hl,-0.12,hw+0.18],[-hl,-0.06,hw+0.18]], [[hl,-0.12,hw+0.18],[hl,-0.06,hw+0.18]],
      [[hl+0.14,-0.12,-hw],[hl+0.2,-0.12,-hw]], [[hl+0.14,-0.12,hw],[hl+0.2,-0.12,hw]],
    ].forEach(([p1,p2])=>{
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1),new THREE.Vector3(...p2)]),
        dMat.clone()
      ));
    });

    // ── CONTROLS ──────────────────────────────────────────────────
    let drag=false, px=0, py=0;
    renderer.domElement.addEventListener("mousedown", e=>{
      drag=true; px=e.clientX; py=e.clientY;
      stateRef.current.rotate=false; setUi(s=>({...s,rotate:false}));
    });
    window.addEventListener("mouseup",()=>{ drag=false; });
    window.addEventListener("mousemove", e=>{
      if(!drag) return;
      theta -= (e.clientX-px)*0.008; px=e.clientX;
      phi = Math.max(0.05, Math.min(1.45, phi-(e.clientY-py)*0.006)); py=e.clientY;
      syncCam();
    });
    renderer.domElement.addEventListener("wheel", e=>{
      radius = Math.max(2.5, Math.min(12, radius+e.deltaY*0.005)); syncCam();
    });
    let tp=null;
    renderer.domElement.addEventListener("touchstart",e=>{ tp=e.touches[0]; stateRef.current.rotate=false; });
    renderer.domElement.addEventListener("touchmove",e=>{
      if(!tp) return;
      const t=e.touches[0];
      theta -= (t.clientX-tp.clientX)*0.008;
      phi = Math.max(0.05,Math.min(1.45, phi-(t.clientY-tp.clientY)*0.006));
      syncCam(); tp=t;
    });

    // Hover
    const raycaster = new THREE.Raycaster();
    const mouse2    = new THREE.Vector2();
    renderer.domElement.addEventListener("mousemove", e=>{
      const rect = renderer.domElement.getBoundingClientRect();
      mouse2.x = ((e.clientX-rect.left)/rect.width)*2-1;
      mouse2.y =-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse2, cam3d);
      const flat = Object.entries(meshMap).flatMap(([id,obj])=>
        obj instanceof THREE.Group ? obj.children.map(c=>({id,c})) : [{id,c:obj}]
      );
      const hits = raycaster.intersectObjects(flat.map(f=>f.c));
      if(hits.length){
        const m = flat.find(f=>f.c===hits[0].object);
        if(m) setHov(m.id);
      } else setHov(null);
    });

    // ── ANIMATE ───────────────────────────────────────────────────
    let raf;
    const clk = new THREE.Clock();
    const animate = ()=>{
      raf = requestAnimationFrame(animate);
      const t = clk.getElapsedTime();
      if(stateRef.current.rotate){ theta += 0.003; syncCam(); }

      // Panel hinge
      const tgt = stateRef.current.panelOpen ? -Math.PI*0.72 : 0;
      panGroup.rotation.x += (tgt - panGroup.rotation.x)*0.08;

      // IR pulse
      ["ir_entry","ir_exit"].forEach(id=>{
        if(meshMap[id]) meshMap[id].material.opacity = 0.35+0.35*Math.sin(t*3.5);
      });

      // Wiring toggle
      ["wire_L","wire_R","wire_ceil"].forEach(id=>{
        if(meshMap[id]) meshMap[id].visible = stateRef.current.showWiring;
      });

      renderer.render(scene, cam3d);
    };
    animate();

    const onResize=()=>{
      const w=el.clientWidth, h=el.clientHeight;
      cam3d.aspect=w/h; cam3d.updateProjectionMatrix(); renderer.setSize(w,h);
    };
    window.addEventListener("resize", onResize);
    return ()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("mouseup",()=>{});
      window.removeEventListener("mousemove",()=>{});
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  const toggle = k => { stateRef.current[k]=!stateRef.current[k]; setUi(s=>({...s,[k]:!s[k]})); };
  const hovC   = COMPONENTS.find(c=>c.id===hovered);

  return (
    <div style={{background:"#07090f",minHeight:"100vh",color:"#c0d4e8",fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column",padding:12,gap:10,boxSizing:"border-box"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:9,color:"#2a4a6a",letterSpacing:4}}>TUNNEL PLATFORM · v3.0 · 4-CAMERA SYSTEM</div>
          <h1 style={{margin:0,fontSize:17,color:"#00ffe0"}}>🐔 Chicken Weighing Tunnel — 3D Design</h1>
          <div style={{fontSize:10,color:"#334455",marginTop:2}}>Open both ends · Chickens walk straight through · Drag to rotate · Scroll to zoom</div>
        </div>
        <div style={{background:"#0a1520",border:"1px solid #1a3a5a",borderRadius:8,padding:"8px 14px"}}>
          <div style={{fontSize:9,color:"#446688",letterSpacing:2,marginBottom:5}}>TUNNEL DIMENSIONS</div>
          <div style={{display:"flex",gap:12}}>
            {[["Length","80 cm"],["Width","50 cm"],["Height","60 cm"],["Panel","20 cm"]].map(([l,v])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:8,color:"#556677"}}>{l}</div>
                <div style={{fontSize:13,color:"#00ffe0",fontWeight:"bold"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:10,flex:1,flexWrap:"wrap"}}>

        {/* 3D Viewport */}
        <div style={{flex:"1 1 420px",position:"relative"}}>
          <div ref={mountRef} style={{width:"100%",height:"500px",borderRadius:8,border:"1px solid #1a2a3a",overflow:"hidden",cursor:"grab"}}/>

          {hovC && (
            <div style={{position:"absolute",bottom:12,left:12,background:"rgba(7,9,15,0.96)",border:`1px solid ${TYPE_COLORS[hovC.type]}`,borderRadius:7,padding:"8px 14px",fontSize:11,lineHeight:1.9,boxShadow:`0 0 18px ${TYPE_COLORS[hovC.type]}44`}}>
              <div style={{color:TYPE_COLORS[hovC.type],fontWeight:"bold",fontSize:13}}>● {hovC.label}</div>
              <div style={{color:"#446688",fontSize:9,textTransform:"uppercase",letterSpacing:2}}>{hovC.type}</div>
            </div>
          )}

          {/* Controls */}
          <div style={{position:"absolute",top:10,right:10,display:"flex",flexDirection:"column",gap:5}}>
            {[
              {k:"rotate",    on:"⟳ Rotating",  off:"⏸ Paused"},
              {k:"panelOpen", on:"▲ Panel Open", off:"▼ Panel Closed"},
              {k:"showWiring",on:"⚡ Wiring On",  off:"⚡ Wiring Off"},
            ].map(({k,on,off})=>(
              <button key={k} onClick={()=>toggle(k)} style={{background:"rgba(7,9,15,0.9)",border:`1px solid ${ui[k]?"#00ffe066":"#1a2a3a"}`,color:ui[k]?"#00ffe0":"#445566",borderRadius:5,padding:"5px 10px",fontSize:10,cursor:"pointer"}}>
                {ui[k]?on:off}
              </button>
            ))}
          </div>

          {/* Entry/Exit legend */}
          <div style={{position:"absolute",top:10,left:12,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{background:"rgba(0,180,80,0.15)",border:"1px solid #00cc5588",borderRadius:5,padding:"3px 10px",fontSize:10,color:"#00cc55"}}>🟢 Entry (Green arch)</div>
            <div style={{background:"rgba(255,80,30,0.15)",border:"1px solid #ff553388",borderRadius:5,padding:"3px 10px",fontSize:10,color:"#ff7755"}}>🔴 Exit (Orange arch)</div>
          </div>
        </div>

        {/* Right info panel */}
        <div style={{flex:"0 0 210px",display:"flex",flexDirection:"column",gap:8}}>

          {/* Camera list */}
          <div style={{background:"#0a1018",border:"1px solid #00d4ff33",borderRadius:8,padding:11}}>
            <div style={{fontSize:9,color:"#00d4ff",letterSpacing:3,marginBottom:8}}>4 CAMERAS</div>
            {[
              {id:"cam_top",   l:"Top Camera",       n:"Ceiling center, pointing ↓"},
              {id:"cam_sideL", l:"Side Cam (Back)",  n:"Back wall, pointing forward"},
              {id:"cam_sideR", l:"Side Cam (Front)", n:"Front wall, pointing inward"},
              {id:"cam_front", l:"Front Camera",     n:"Entry arch, angled 25° down"},
            ].map(c=>(
              <div key={c.id} style={{marginBottom:7,paddingBottom:7,borderBottom:"1px solid #0d1824",opacity:hovered&&hovered!==c.id?0.35:1,transition:"opacity 0.15s"}}>
                <div style={{color:"#00d4ff",fontSize:11,fontWeight:"bold"}}>● {c.l}</div>
                <div style={{color:"#445566",fontSize:9,marginTop:1}}>{c.n}</div>
              </div>
            ))}
          </div>

          {/* Component legend */}
          <div style={{background:"#0a1018",border:"1px solid #1a2a3a",borderRadius:8,padding:11,flex:1,overflowY:"auto"}}>
            <div style={{fontSize:9,color:"#446688",letterSpacing:3,marginBottom:8}}>ALL COMPONENTS</div>
            {Object.entries(TYPE_COLORS).map(([type,color])=>(
              <div key={type}>
                <div style={{fontSize:8,color:"#2a3a4a",letterSpacing:2,textTransform:"uppercase",margin:"8px 0 3px",borderBottom:"1px solid #0d1824",paddingBottom:2}}>{type}</div>
                {COMPONENTS.filter(c=>c.type===type).map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,fontSize:10,opacity:hovered&&hovered!==c.id?0.28:1,transition:"opacity 0.15s"}}>
                    <div style={{width:7,height:7,borderRadius:2,background:color,flexShrink:0,boxShadow:`0 0 4px ${color}88`}}/>
                    <span style={{color:"#7a8a9a"}}>{c.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Wiring note */}
          <div style={{background:"#0a0d08",border:"1px solid #ff990033",borderRadius:8,padding:10,fontSize:10,color:"#665533",lineHeight:1.75}}>
            <div style={{color:"#ff9900",marginBottom:3}}>⚡ In-Wall Conduits</div>
            Orange tubes run inside the walls from floor level up to the work panel. All camera and sensor cables route through these — no external cables, no drilling after assembly.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{background:"#0a1018",border:"1px solid #1a2a3a",borderRadius:8,padding:"9px 14px",display:"flex",gap:14,flexWrap:"wrap",fontSize:10}}>
        {[
          {c:"#eef2f6", l:"White Tunnel",   s:"Consistent background for all cameras"},
          {c:"#00cc55", l:"Green = Entry",   s:"Chicken walks in this side"},
          {c:"#ff7755", l:"Orange = Exit",   s:"Chicken walks out this side"},
          {c:"#00d4ff", l:"4 Cameras",       s:"Top + Side×2 + Entry front cam"},
          {c:"#ffcc00", l:"LED Panels",      s:"Fixed brightness ceiling + sides"},
          {c:"#ff3333", l:"IR Beams",        s:"Entry + exit position triggers"},
          {c:"#ff9900", l:"In-wall Wiring",  s:"Pre-routed, no post-assembly drilling"},
          {c:"#88aaff", l:"Work Panel",      s:"Hinged lid — hardware bay on top"},
        ].map(({c,l,s})=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:9,height:9,borderRadius:2,background:c,flexShrink:0,boxShadow:`0 0 5px ${c}77`}}/>
            <div><div style={{color:c,fontWeight:"bold"}}>{l}</div><div style={{color:"#334455"}}>{s}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
