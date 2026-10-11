/*
  Sincronización con Supabase. La App sigue funcionando sin conexión: los controles se guardan
  primero en el dispositivo y se suben cuando hay red. Si la librería no cargó, todo queda local.
*/
(function () {
  'use strict';
  const C = window.PV_CONTENIDO;
  const D = window.PV_DATOS;
  const CFG = window.PV_CONFIG || {};
  const disponible = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);

  // Paciente y profesional usan sesiones separadas para poder convivir en un mismo dispositivo.
  function crearCliente(claveSesion, leerUrl) {
    if (!disponible) return null;
    return window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { storageKey: claveSesion, persistSession: true, autoRefreshToken: true, detectSessionInUrl: leerUrl }
    });
  }

  // --- Paciente ---
  let paciente = null;
  let enCurso = null;

  const pendientes = function (estado) {
    return estado.controles.filter(function (c) { return !c.ejemplo && !c.subido; });
  };

  async function subir(estado, guardar) {
    if (!disponible || !navigator.onLine || !estado.basal) return false;
    paciente = paciente || crearCliente('pv-paciente', false);

    let sesion = (await paciente.auth.getSession()).data.session;
    if (!sesion) {
      const ingreso = await paciente.auth.signInAnonymously();
      if (ingreso.error) return false;
      sesion = ingreso.data.session;
    }
    const uid = sesion.user.id;
    const cola = pendientes(estado);

    if (!estado.pacienteSubido || cola.length) {
      const alta = await paciente.from('pacientes').upsert({
        id: uid, nombre: estado.nombre, consentimiento: estado.consentimiento, basal: estado.basal
      });
      if (alta.error) return false;
      estado.pacienteSubido = true;
      guardar();
    }

    for (const control of cola) {
      // Primero las fotos: cuando el equipo recibe el aviso, ya tienen que estar disponibles.
      for (const foto of C.fotos) {
        if (control.fotos[foto.id] !== 'ok') continue;
        const dataUrl = await D.leerFoto(control.id, foto.id);
        if (!dataUrl) continue;
        const archivo = await (await fetch(dataUrl)).blob();
        const subida = await paciente.storage.from('fotos')
          .upload(uid + '/' + control.id + '/' + foto.id + '.jpg', archivo, { contentType: 'image/jpeg', upsert: false });
        if (subida.error && !/exist|duplicate/i.test(subida.error.message)) return false;
      }
      const alta = await paciente.from('controles').insert({
        id: control.id, fecha: control.fecha, respuestas: control.respuestas, fotos: control.fotos,
        realizado_por: control.realizadoPor, avisos: control.avisos
      });
      if (alta.error && alta.error.code !== '23505') return false; // 23505: ya estaba subido
      control.subido = true;
      guardar();
    }
    return true;
  }

  function sincronizar(estado, guardar) {
    if (!enCurso) {
      enCurso = subir(estado, guardar).catch(function () { return false; }).then(function (ok) { enCurso = null; return ok; });
    }
    return enCurso;
  }

  function olvidarPaciente() {
    if (!disponible) return Promise.resolve();
    paciente = paciente || crearCliente('pv-paciente', false);
    return paciente.auth.signOut({ scope: 'local' }).catch(function () {});
  }

  // --- Profesional ---
  let profesional = null;
  const clienteProfesional = function () {
    profesional = profesional || crearCliente('pv-profesional', true);
    return profesional;
  };

  async function sesionProfesional() {
    if (!disponible) return null;
    const sesion = (await clienteProfesional().auth.getSession()).data.session;
    return sesion && sesion.user.email ? sesion.user : null;
  }

  function pedirEnlace(email) {
    return clienteProfesional().auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.hostname === 'localhost' ? location.origin + location.pathname : CFG.panelUrl }
    });
  }

  const salirProfesional = function () { return clienteProfesional().auth.signOut({ scope: 'local' }); };

  // Devuelve los pacientes con sus controles, en el mismo formato que usa el panel con datos locales.
  async function leerTodo() {
    const sb = clienteProfesional();
    const [pacientes, controles] = await Promise.all([
      sb.from('pacientes').select('*').order('creado'),
      sb.from('controles').select('*').order('fecha')
    ]);
    if (pacientes.error || controles.error) throw (pacientes.error || controles.error);
    return pacientes.data.map(function (p) {
      return {
        id: p.id, nombre: p.nombre, basal: p.basal, consentimiento: p.consentimiento,
        controles: controles.data.filter(function (c) { return c.paciente === p.id; }).map(function (c) {
          return {
            id: c.id, fecha: c.fecha, respuestas: c.respuestas, fotos: c.fotos,
            realizadoPor: c.realizado_por, avisos: c.avisos || [], revision: c.revision
          };
        })
      };
    });
  }

  async function urlFoto(pacienteId, controlId, fotoId) {
    const firmada = await clienteProfesional().storage.from('fotos')
      .createSignedUrl(pacienteId + '/' + controlId + '/' + fotoId + '.jpg', 3600);
    return firmada.error ? null : firmada.data.signedUrl;
  }

  function guardarRevision(pacienteId, controlId, revision) {
    return clienteProfesional().from('controles').update({ revision: revision })
      .eq('paciente', pacienteId).eq('id', controlId);
  }

  window.PV_NUBE = {
    disponible: disponible, pendientes: pendientes, sincronizar: sincronizar, olvidarPaciente: olvidarPaciente,
    sesionProfesional: sesionProfesional, pedirEnlace: pedirEnlace, salirProfesional: salirProfesional,
    leerTodo: leerTodo, urlFoto: urlFoto, guardarRevision: guardarRevision
  };
})();
