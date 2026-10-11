/*
  CONTENIDO CLÍNICO DE PIE VIVO — BORRADOR PARA REVISIÓN DEL DR. CUÉLLAR

  Todo lo que el paciente lee y todas las reglas de aviso están en este archivo.
  Para cambiar un texto, una pregunta o una regla, se edita acá y se recarga la App:
  la cantidad de pantallas, la barra de progreso y el panel profesional se ajustan solos.

  Niveles de aviso disponibles: "prioritario", "revisar" o null (sin aviso).
*/
window.PV_CONTENIDO = {
  version: "0.1 — borrador sin validación clínica",

  // Opciones de "¿Quién te ayuda hoy?". En el PMV salen de los cuidadores que el paciente autorizó.
  cuidadores: ["Un familiar", "Un cuidador", "Otra persona"],

  // Cada cuántos días se espera un control y cuándo avisar por ausencia.
  frecuencia: {
    diasEntreControles: 1,
    avisarSinControlDias: 3
  },

  consentimiento: {
    version: "borrador-0.1",
    titulo: "Antes de empezar",
    puntos: [
      "Pie Vivo guarda tus respuestas y las fotos de tus pies.",
      "Las ve solamente tu equipo de salud y la persona que vos autorices.",
      "Sirve para acompañarte entre consultas. No reemplaza la consulta ni la guardia.",
      "La App no da diagnósticos ni respuestas inmediatas.",
      "Podés dejar de usarla cuando quieras y pedir que se borren tus datos."
    ]
  },

  // Línea basal: se completa una sola vez, idealmente en la consulta.
  basal: {
    titulo: "Tu punto de partida",
    intro: "Son pocas preguntas sobre cómo están tus pies habitualmente. Se responden una sola vez.",
    preguntas: [
      {
        id: "lesion_previa", etiqueta: "Herida o úlcera previa",
        texto: "¿Tuviste alguna vez una herida o úlcera en los pies?",
        opciones: [{ valor: "no", texto: "No" }, { valor: "si", texto: "Sí" }, { valor: "ns", texto: "No estoy seguro" }]
      },
      {
        id: "sensibilidad_habitual", etiqueta: "Hormigueo o adormecimiento habitual",
        texto: "¿Sentís seguido hormigueo o adormecimiento en los pies?",
        opciones: [{ valor: "no", texto: "No" }, { valor: "si", texto: "Sí" }, { valor: "ns", texto: "No estoy seguro" }]
      },
      {
        id: "dolor_habitual", etiqueta: "Dolor habitual",
        texto: "¿Tenés dolor en los pies la mayoría de los días?",
        opciones: [{ valor: "no", texto: "No" }, { valor: "si", texto: "Sí" }, { valor: "ns", texto: "No estoy seguro" }]
      },
      {
        id: "marcha", etiqueta: "Capacidad para caminar",
        texto: "¿Cómo caminás habitualmente?",
        opciones: [
          { valor: "sola", texto: "Camino sin ayuda" },
          { valor: "apoyo", texto: "Con bastón o andador" },
          { valor: "poco", texto: "Casi no camino" }
        ]
      },
      {
        id: "ve_planta", etiqueta: "Puede verse la planta del pie",
        texto: "¿Podés mirarte la planta de los pies?",
        opciones: [
          { valor: "si", texto: "Sí, sin ayuda" },
          { valor: "ayuda", texto: "Con espejo o con ayuda" },
          { valor: "no", texto: "No puedo" }
        ]
      }
    ]
  },

  preparacion: {
    titulo: "Vamos paso a paso",
    pasos: [
      { icono: "luz", texto: "Buscá un lugar con buena luz." },
      { icono: "telefono", texto: "Tené el teléfono a mano." },
      { icono: "personas", texto: "Podés pedir ayuda para las fotos." }
    ]
  },

  // Preguntas del control periódico. Una por pantalla.
  preguntas: [
    {
      id: "herida", etiqueta: "Herida nueva",
      texto: "¿Ves alguna herida nueva en tus pies?",
      ayuda: "Mirá también entre los dedos y en la planta.",
      opciones: [
        { valor: "no", texto: "No", aviso: null },
        { valor: "si", texto: "Sí", aviso: "prioritario" },
        { valor: "ns", texto: "No estoy seguro", aviso: "revisar" }
      ]
    },
    {
      id: "dolor", etiqueta: "Dolor nuevo o mayor",
      texto: "¿Tenés dolor nuevo o más fuerte en los pies?",
      ayuda: "",
      opciones: [
        { valor: "no", texto: "No", aviso: null },
        { valor: "si", texto: "Sí", aviso: "revisar" },
        { valor: "ns", texto: "No estoy seguro", aviso: "revisar" }
      ]
    },
    {
      id: "enrojecimiento", etiqueta: "Enrojecimiento",
      texto: "¿Ves alguna zona más roja que de costumbre?",
      ayuda: "",
      opciones: [
        { valor: "no", texto: "No", aviso: null },
        { valor: "si", texto: "Sí", aviso: "revisar" },
        { valor: "ns", texto: "No estoy seguro", aviso: "revisar" }
      ]
    },
    {
      id: "hinchazon", etiqueta: "Hinchazón",
      texto: "¿Notás algún pie más hinchado que de costumbre?",
      ayuda: "",
      opciones: [
        { valor: "no", texto: "No", aviso: null },
        { valor: "si", texto: "Sí", aviso: "revisar" },
        { valor: "ns", texto: "No estoy seguro", aviso: "revisar" }
      ]
    },
    {
      id: "sensibilidad", etiqueta: "Cambio de sensibilidad",
      texto: "¿Sentís los pies distintos que de costumbre?",
      ayuda: "Por ejemplo: más hormigueo, adormecimiento o menos sensibilidad.",
      opciones: [
        { valor: "no", texto: "No", aviso: null },
        { valor: "si", texto: "Sí", aviso: "revisar" },
        { valor: "ns", texto: "No estoy seguro", aviso: "revisar" }
      ]
    },
    {
      id: "caminar", etiqueta: "Dificultad para caminar",
      texto: "¿Te cuesta caminar más que de costumbre?",
      ayuda: "",
      opciones: [
        { valor: "no", texto: "No", aviso: null },
        { valor: "si", texto: "Sí", aviso: "revisar" },
        { valor: "ns", texto: "No estoy seguro", aviso: "revisar" }
      ]
    }
  ],

  // Fotografías guiadas, en el orden en que se piden.
  fotos: [
    { id: "der_superior", titulo: "Parte superior del pie derecho", guia: "Apoyá el pie y buscá buena luz." },
    { id: "der_planta", titulo: "Planta del pie derecho", guia: "Sentate, cruzá la pierna o pedí ayuda." },
    { id: "izq_superior", titulo: "Parte superior del pie izquierdo", guia: "Apoyá el pie y buscá buena luz." },
    { id: "izq_planta", titulo: "Planta del pie izquierdo", guia: "Sentate, cruzá la pierna o pedí ayuda." }
  ],

  // Reglas que se suman a los avisos definidos en cada respuesta.
  reglas: {
    combinacion: { minimoRespuestasSi: 2, aviso: "prioritario" },
    fotoFaltante: { aviso: "revisar" }
  },

  confirmacion: {
    titulo: "Control enviado",
    texto: "Tu registro quedó guardado para revisión del equipo.",
    advertencia: "Si necesitás atención, no esperes una respuesta de la App."
  },

  // Pantalla "Necesito ayuda". Señales y vías de contacto a definir por el equipo.
  ayuda: {
    titulo: "¿Necesitás ayuda?",
    alarmaTitulo: "No esperes a la App si tenés:",
    senales: [
      "Una herida abierta, que sangra o larga líquido.",
      "Un pie muy hinchado, rojo o caliente.",
      "Una zona negra o violácea.",
      "Fiebre o escalofríos junto con dolor en el pie.",
      "Un dolor fuerte que no se va."
    ],
    alarmaAccion: "Llamá a tu equipo o andá a la guardia.",
    contactos: [
      { texto: "Llamar al equipo", telefono: "", pendiente: "Teléfono y horario del equipo: a definir" },
      { texto: "Emergencias", telefono: "", pendiente: "Número de guardia o emergencias: a definir" }
    ],
    usoTitulo: "Para usar la App",
    uso: [
      "Tocá “Hacer mi control” y seguí los pasos.",
      "Si te equivocás, tocá “Volver”.",
      "Un familiar o cuidador puede ayudarte con las fotos."
    ]
  }
};
