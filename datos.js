/*
  Datos del prototipo. Todo queda en este dispositivo (localStorage + IndexedDB);
  nada se envía a un servidor. En el PMV este archivo se reemplaza por Supabase.
*/
(function () {
  'use strict';
  const C = window.PV_CONTENIDO;
  const CLAVE = 'pievivo_proto_v1';
  const DIA = 24 * 60 * 60 * 1000;

  function vacio() {
    return { consentimiento: null, basal: null, controles: [], borrador: null };
  }

  function leer() {
    try {
      return Object.assign(vacio(), JSON.parse(localStorage.getItem(CLAVE)));
    } catch (e) {
      return vacio();
    }
  }

  function guardar(estado) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) { /* almacenamiento bloqueado: el prototipo sigue en memoria */ }
  }

  // --- Fotos (IndexedDB) ---
  function abrir() {
    return new Promise(function (ok, error) {
      const pedido = indexedDB.open('pievivo_proto', 1);
      pedido.onupgradeneeded = function () { pedido.result.createObjectStore('fotos'); };
      pedido.onsuccess = function () { ok(pedido.result); };
      pedido.onerror = function () { error(pedido.error); };
    });
  }

  function conAlmacen(modo, operar) {
    return abrir().then(function (db) {
      return new Promise(function (ok, error) {
        const tx = db.transaction('fotos', modo);
        const pedido = operar(tx.objectStore('fotos'));
        tx.oncomplete = function () { ok(pedido && pedido.result); };
        tx.onerror = function () { error(tx.error); };
      });
    });
  }

  const claveFoto = function (controlId, fotoId) { return controlId + ':' + fotoId; };
  const guardarFoto = function (controlId, fotoId, dataUrl) {
    return conAlmacen('readwrite', function (a) { return a.put(dataUrl, claveFoto(controlId, fotoId)); });
  };
  const leerFoto = function (controlId, fotoId) {
    return conAlmacen('readonly', function (a) { return a.get(claveFoto(controlId, fotoId)); }).catch(function () { return null; });
  };
  const borrarFoto = function (controlId, fotoId) {
    return conAlmacen('readwrite', function (a) { return a.delete(claveFoto(controlId, fotoId)); }).catch(function () {});
  };

  function reiniciar() {
    localStorage.removeItem(CLAVE);
    return conAlmacen('readwrite', function (a) { return a.clear(); }).catch(function () {});
  }

  // --- Reglas de aviso (determinísticas, definidas en contenido.js) ---
  const ORDEN = { prioritario: 0, revisar: 1 };

  function evaluar(control) {
    const avisos = [];
    let respuestasSi = 0;
    C.preguntas.forEach(function (p) {
      const valor = control.respuestas[p.id];
      const opcion = p.opciones.find(function (o) { return o.valor === valor; });
      if (valor === 'si') respuestasSi++;
      if (opcion && opcion.aviso) avisos.push({ nivel: opcion.aviso, texto: p.etiqueta + ': ' + opcion.texto });
    });
    const combo = C.reglas.combinacion;
    if (respuestasSi >= combo.minimoRespuestasSi) {
      avisos.push({ nivel: combo.aviso, texto: respuestasSi + ' cambios informados en el mismo control' });
    }
    const faltan = C.fotos.filter(function (f) { return control.fotos[f.id] !== 'ok'; });
    if (faltan.length) {
      avisos.push({
        nivel: C.reglas.fotoFaltante.aviso,
        texto: 'Fotos faltantes: ' + faltan.map(function (f) { return f.titulo; }).join(', ')
      });
    }
    return avisos.sort(function (a, b) { return ORDEN[a.nivel] - ORDEN[b.nivel]; });
  }

  const nivelMaximo = function (avisos) {
    if (!avisos.length) return null;
    return avisos.some(function (a) { return a.nivel === 'prioritario'; }) ? 'prioritario' : 'revisar';
  };

  // Controles de ejemplo de los días anteriores, para que el historial no arranque vacío.
  function sembrarEjemplos(estado) {
    const hoy = Date.now();
    for (let dias = 5; dias >= 1; dias--) {
      const respuestas = {};
      C.preguntas.forEach(function (p) { respuestas[p.id] = 'no'; });
      const fotos = {};
      C.fotos.forEach(function (f) { fotos[f.id] = 'ok'; });
      estado.controles.push({
        id: 'ejemplo-' + dias,
        ejemplo: true,
        fecha: new Date(hoy - dias * DIA).toISOString(),
        respuestas: respuestas,
        fotos: fotos,
        realizadoPor: { tipo: 'paciente', nombre: estado.nombre },
        avisos: [],
        revision: null
      });
    }
  }

  // --- Fechas ---
  function diasDesde(iso) {
    const a = new Date(iso); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / DIA);
  }

  function fechaRelativa(iso) {
    const d = diasDesde(iso);
    if (d <= 0) return 'hoy';
    if (d === 1) return 'ayer';
    return 'hace ' + d + ' días';
  }

  function fechaCorta(iso) {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  function fechaLarga(iso) {
    return new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  const ultimoControl = function (estado) { return estado.controles[estado.controles.length - 1] || null; };

  window.PV_DATOS = {
    leer: leer, guardar: guardar, reiniciar: reiniciar,
    guardarFoto: guardarFoto, leerFoto: leerFoto, borrarFoto: borrarFoto,
    evaluar: evaluar, nivelMaximo: nivelMaximo, sembrarEjemplos: sembrarEjemplos,
    diasDesde: diasDesde, fechaRelativa: fechaRelativa, fechaCorta: fechaCorta, fechaLarga: fechaLarga,
    ultimoControl: ultimoControl
  };
})();
