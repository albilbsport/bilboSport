const https = require('https');
const bcrypt = require('bcryptjs');
const db = require('./database');

const FALLBACK_EXERCISES = [
  {
    external_id: 'fb-001',
    name: 'Press de Banca Plano con Barra',
    body_part: 'chest',
    category: 'barbell',
    equipment: 'barbell',
    target: 'pectorals',
    muscle_group: 'triceps, deltoids',
    measure_type: 'reps',
    instructions_es: 'Acuéstate sobre el banco plano. Agarra la barra con las manos algo más abiertas que los hombros. Baja la barra de forma controlada al pecho y empuja con fuerza hacia arriba.',
    instructions_en: 'Lie back on a flat bench. Grip the bar with hands slightly wider than shoulder-width. Lower the bar smoothly to your mid-chest and press up forcefully.'
  },
  {
    external_id: 'fb-002',
    name: 'Sentadilla Trasera con Barra (Squat)',
    body_part: 'legs',
    category: 'barbell',
    equipment: 'barbell',
    target: 'quads',
    muscle_group: 'glutes, hamstrings, core',
    measure_type: 'reps',
    instructions_es: 'Coloca la barra sobre la espalda superior. Desciende flexionando caderas y rodillas manteniendo el torso recto hasta romper la paralela. Sube extendiendo caderas y rodillas.',
    instructions_en: 'Place bar on upper back. Squat down by flexing hips and knees, keeping chest up, until thighs break parallel. Drive back up.'
  },
  {
    external_id: 'fb-003',
    name: 'Peso Muerto Convencional (Deadlift)',
    body_part: 'back',
    category: 'barbell',
    equipment: 'barbell',
    target: 'hamstrings',
    muscle_group: 'erector spinae, glutes, lats, traps',
    measure_type: 'reps',
    instructions_es: 'Pies bajo la barra a anchura de caderas. Agarra la barra, aprieta la espalda, eleva el pecho y levanta el peso empujando el suelo con las piernas hasta bloquear caderas.',
    instructions_en: 'Stand with feet hip-width under bar. Grip bar, engage back, keep chest proud, and pull weight up pushing floor away until hip lockout.'
  },
  {
    external_id: 'fb-004',
    name: 'Press Militar de Pie (Overhead Press)',
    body_part: 'shoulders',
    category: 'barbell',
    equipment: 'barbell',
    target: 'deltoids',
    muscle_group: 'triceps, core, upper chest',
    measure_type: 'reps',
    instructions_es: 'Sostén la barra a la altura de las clavículas. Aprieta abdomen y glúteos y empuja la barra directamente sobre la cabeza hasta bloquear los codos.',
    instructions_en: 'Hold bar at collarbone height. Brace core and glutes, press bar straight overhead to lockout.'
  },
  {
    external_id: 'fb-005',
    name: 'Remo con Barra (Pendlay / Barbell Row)',
    body_part: 'back',
    category: 'barbell',
    equipment: 'barbell',
    target: 'lats',
    muscle_group: 'rhomboids, rear delts, biceps',
    measure_type: 'reps',
    instructions_es: 'Inclina el torso hacia adelante a 45 grados con la espalda recta. Tira de la barra hacia la parte baja del pecho o abdomen, contrayendo las escápulas.',
    instructions_en: 'Hinge forward at 45 degrees with flat back. Pull bar towards lower ribcage/navel, squeezing shoulder blades together.'
  },
  {
    external_id: 'fb-006',
    name: 'Dominadas Pronas (Pull-ups)',
    body_part: 'back',
    category: 'bodyweight',
    equipment: 'pull-up bar',
    target: 'lats',
    muscle_group: 'biceps, forearms, core',
    measure_type: 'reps',
    instructions_es: 'Cuélgate con agarre prono más ancho que los hombros. Tira hacia arriba hasta que la barbilla supere la barra.',
    instructions_en: 'Hang with overhand grip wider than shoulder-width. Pull yourself up until your chin clears the bar.'
  },
  {
    external_id: 'fb-007',
    name: 'Dominadas Supinas (Chin-ups)',
    body_part: 'back',
    category: 'bodyweight',
    equipment: 'pull-up bar',
    target: 'biceps',
    muscle_group: 'lats, upper back',
    measure_type: 'reps',
    instructions_es: 'Cuélgate con las palmas mirando hacia ti a la anchura de hombros. Eleva el cuerpo contrayendo bíceps y espalda.',
    instructions_en: 'Hang with underhand grip shoulder-width apart. Pull your body up focusing on biceps and lat contraction.'
  },
  {
    external_id: 'fb-008',
    name: 'Fondos en Paralelas (Dips)',
    body_part: 'chest',
    category: 'bodyweight',
    equipment: 'parallel bars',
    target: 'triceps',
    muscle_group: 'pectorals, anterior deltoids',
    measure_type: 'reps',
    instructions_es: 'Suspéndete de las barras paralelas. Inclina ligeramente el torso y baja flexionando codos hasta 90 grados. Empuja arriba.',
    instructions_en: 'Support body on parallel bars. Lean slightly forward and lower until elbows hit 90 degrees. Press back up.'
  },
  {
    external_id: 'fb-009',
    name: 'Press Inclinado con Mancuernas',
    body_part: 'chest',
    category: 'dumbbell',
    equipment: 'dumbbell',
    target: 'upper pectorals',
    muscle_group: 'anterior deltoids, triceps',
    measure_type: 'reps',
    instructions_es: 'Banco inclinado a 30 grados. Empuja las mancuernas desde los hombros hacia arriba de manera convergente.',
    instructions_en: 'Set bench to 30 degrees incline. Press dumbbells upward from shoulder height with slight inward convergence.'
  },
  {
    external_id: 'fb-010',
    name: 'Press Plano con Mancuernas',
    body_part: 'chest',
    category: 'dumbbell',
    equipment: 'dumbbell',
    target: 'pectorals',
    muscle_group: 'triceps, deltoids',
    measure_type: 'reps',
    instructions_es: 'Acuéstate con una mancuerna en cada mano. Empuja verticalmente y controla la bajada sintiendo el estiramiento pectoral.',
    instructions_en: 'Lie on flat bench with dumbbells. Press vertically, lowering with control to feel full chest stretch.'
  },
  {
    external_id: 'fb-011',
    name: 'Press de Hombros con Mancuernas (Sentado)',
    body_part: 'shoulders',
    category: 'dumbbell',
    equipment: 'dumbbell',
    target: 'deltoids',
    muscle_group: 'triceps, upper chest',
    measure_type: 'reps',
    instructions_es: 'Sentado en banco a 85 grados, empuja las mancuernas sobre la cabeza sin arquear la zona lumbar.',
    instructions_en: 'Seated on an upright bench, press dumbbells overhead without excessively overarching lower back.'
  },
  {
    external_id: 'fb-012',
    name: 'Elevaciones Laterales con Mancuernas',
    body_part: 'shoulders',
    category: 'dumbbell',
    equipment: 'dumbbell',
    target: 'lateral deltoids',
    muscle_group: 'trapezius',
    measure_type: 'reps',
    instructions_es: 'De pie, levanta las mancuernas lateralmente con ligera flexión de codos hasta la altura de los hombros.',
    instructions_en: 'Standing, raise dumbbells laterally with slight elbow bend until parallel with shoulders.'
  },
  {
    external_id: 'fb-013',
    name: 'Curl de Bíceps con Barra Z',
    body_part: 'arms',
    category: 'barbell',
    equipment: 'ez barbell',
    target: 'biceps',
    muscle_group: 'brachialis, forearms',
    measure_type: 'reps',
    instructions_es: 'De pie con barra Z, flexiona los codos manteniendo los brazos pegados a los costados.',
    instructions_en: 'Standing with EZ curl bar, curl weight up while keeping upper arms fixed to sides.'
  },
  {
    external_id: 'fb-014',
    name: 'Curl Martillo con Mancuernas',
    body_part: 'arms',
    category: 'dumbbell',
    equipment: 'dumbbell',
    target: 'brachioradialis',
    muscle_group: 'biceps, forearms',
    measure_type: 'reps',
    instructions_es: 'Con agarre neutro (palmas enfrentadas), eleva las mancuernas hacia los hombros sin balanceo.',
    instructions_en: 'Hold dumbbells with neutral palms-facing grip, curl towards shoulders without torso swing.'
  },
  {
    external_id: 'fb-015',
    name: 'Extensión de Tríceps en Polea (Tricep Pushdown)',
    body_part: 'arms',
    category: 'cable',
    equipment: 'cable machine',
    target: 'triceps',
    muscle_group: 'forearms',
    measure_type: 'reps',
    instructions_es: 'Con cuerda o barra recta en polea alta, extiende los codos hacia abajo abriendo al final del recorrido.',
    instructions_en: 'Using rope or straight bar on high cable pulley, extend elbows downward and squeeze triceps at bottom.'
  },
  {
    external_id: 'fb-016',
    name: 'Press Francés / Skull Crusher',
    body_part: 'arms',
    category: 'barbell',
    equipment: 'ez barbell',
    target: 'triceps',
    muscle_group: 'shoulders',
    measure_type: 'reps',
    instructions_es: 'Acuéstate en banco plano, baja la barra Z hacia la frente o justo detrás de la cabeza flexionando codos.',
    instructions_en: 'Lie on flat bench, lower EZ bar towards forehead or crown by flexing elbows, then extend back up.'
  },
  {
    external_id: 'fb-017',
    name: 'Prensa de Piernas 45 Grados (Leg Press)',
    body_part: 'legs',
    category: 'machine',
    equipment: 'leg press machine',
    target: 'quads',
    muscle_group: 'glutes, hamstrings',
    measure_type: 'reps',
    instructions_es: 'Coloca pies en la plataforma a anchura de hombros. Desciende flexionando rodillas a 90 grados y empuja con los talones.',
    instructions_en: 'Place feet shoulder-width on footplate. Lower sled to 90 degrees knee bend, drive back through heels.'
  },
  {
    external_id: 'fb-018',
    name: 'Peso Muerto Rumano (RDL)',
    body_part: 'legs',
    category: 'barbell',
    equipment: 'barbell',
    target: 'hamstrings',
    muscle_group: 'glutes, lower back',
    measure_type: 'reps',
    instructions_es: 'Con rodillas semiflexionadas, empuja las caderas hacia atrás bajando la barra rozando las piernas hasta notar tensión en femorales.',
    instructions_en: 'With soft knees, hinge hips back lowering bar close to shins until deep hamstring stretch is felt. Squeeze glutes forward.'
  },
  {
    external_id: 'fb-019',
    name: 'Extensiones de Cuádriceps en Máquina',
    body_part: 'legs',
    category: 'machine',
    equipment: 'machine',
    target: 'quads',
    muscle_group: 'rectus femoris',
    measure_type: 'reps',
    instructions_es: 'Sentado en la máquina, extiende las piernas completamente contrayendo los cuádriceps 1 segundo arriba.',
    instructions_en: 'Seated in leg extension machine, extend knees fully, pausing 1 second at full quad contraction.'
  },
  {
    external_id: 'fb-020',
    name: 'Curl Femoral Tumbado en Máquina',
    body_part: 'legs',
    category: 'machine',
    equipment: 'machine',
    target: 'hamstrings',
    muscle_group: 'calves',
    measure_type: 'reps',
    instructions_es: 'Tumbado boca abajo, flexiona las rodillas llevando los talones hacia los glúteos de forma controlada.',
    instructions_en: 'Lie face down on prone leg curl machine. Curl heels toward glutes and control the eccentric descent.'
  },
  {
    external_id: 'fb-021',
    name: 'Elevación de Talones para Gemelos (Calf Raise)',
    body_part: 'legs',
    category: 'machine',
    equipment: 'calf machine',
    target: 'calves',
    muscle_group: 'soleus, gastrocnemius',
    measure_type: 'reps',
    instructions_es: 'Coloca la punta de los pies en el escalón. Estira al máximo abajo y sube sobre las puntas aguantando la contracción.',
    instructions_en: 'Place balls of feet on block. Stretch deeply at bottom and push onto toes pausing at peak contraction.'
  },
  {
    external_id: 'fb-022',
    name: 'Face Pull en Polea con Cuerda',
    body_part: 'shoulders',
    category: 'cable',
    equipment: 'cable machine',
    target: 'rear deltoids',
    muscle_group: 'rotator cuff, rhomboids, upper traps',
    measure_type: 'reps',
    instructions_es: 'Coloca polea a la altura del cuello. Tira de la cuerda hacia la cara rotando externamente los hombros.',
    instructions_en: 'Set pulley at neck level. Pull rope attachment toward face, rotating hands back and pinching shoulder blades.'
  },
  {
    external_id: 'fb-023',
    name: 'Jalón al Pecho en Polea (Lat Pulldown)',
    body_part: 'back',
    category: 'cable',
    equipment: 'cable machine',
    target: 'lats',
    muscle_group: 'biceps, rhomboids',
    measure_type: 'reps',
    instructions_es: 'Sentado con rodillas bloqueadas, tira de la barra hacia la parte alta del esternón retrayendo escápulas.',
    instructions_en: 'Seated with thighs locked under pads, pull wide bar down smoothly to upper chest while depressing scapulae.'
  },
  {
    external_id: 'fb-024',
    name: 'Remo Sentado en Polea Baja (Cable Row)',
    body_part: 'back',
    category: 'cable',
    equipment: 'cable machine',
    target: 'middle back',
    muscle_group: 'lats, rhomboids, biceps',
    measure_type: 'reps',
    instructions_es: 'Pies apoyados, espalda neutra. Tira del agarre hacia el ombligo juntando las escápulas.',
    instructions_en: 'Sit with feet braced and upright torso. Pull handle towards navel, squeezing shoulder blades together.'
  },
  {
    external_id: 'fb-025',
    name: 'Cruces de Poleas para Pecho (Cable Fly)',
    body_part: 'chest',
    category: 'cable',
    equipment: 'cable machine',
    target: 'pectorals',
    muscle_group: 'anterior deltoids',
    measure_type: 'reps',
    instructions_es: 'Con poleas medias o altas, junta las manos frente al pecho en un movimiento de abrazo amplio.',
    instructions_en: 'With cables at chest height, bring hands together in a wide hugging motion squeezing pecs.'
  },
  {
    external_id: 'fb-026',
    name: 'Flexiones de Pecho (Push-ups)',
    body_part: 'chest',
    category: 'bodyweight',
    equipment: 'bodyweight',
    target: 'pectorals',
    muscle_group: 'triceps, core, shoulders',
    measure_type: 'reps',
    instructions_es: 'Cuerpo en plancha firme. Baja el pecho casi hasta el suelo con codos a 45 grados y empuja con potencia.',
    instructions_en: 'Body in strong plank. Lower chest to floor with elbows angled at 45 degrees, then press up.'
  },
  {
    external_id: 'fb-027',
    name: 'Hip Thrust con Barra (Empuje de Cadera)',
    body_part: 'glutes',
    category: 'barbell',
    equipment: 'barbell',
    target: 'glutes',
    muscle_group: 'hamstrings, core',
    measure_type: 'reps',
    instructions_es: 'Espalda apoyada en banco a la altura de escápulas, barra sobre caderas. Empuja con talones hasta alinear torso y muslos.',
    instructions_en: 'Rest upper back against bench with barbell cushioned over hips. Drive through heels to full hip extension.'
  },
  {
    external_id: 'fb-028',
    name: 'Sentadilla Frontal con Barra (Front Squat)',
    body_part: 'legs',
    category: 'barbell',
    equipment: 'barbell',
    target: 'quads',
    muscle_group: 'core, glutes, upper back',
    measure_type: 'reps',
    instructions_es: 'Barra descansando sobre hombros delanteros y clavícula. Mantén los codos altos y el torso muy vertical al bajar.',
    instructions_en: 'Rest barbell on front deltoids with clean grip. Keep elbows high and torso upright throughout the squat.'
  },
  {
    external_id: 'fb-029',
    name: 'Encogimientos de Hombros con Barra (Shrugs)',
    body_part: 'back',
    category: 'barbell',
    equipment: 'barbell',
    target: 'trapezius',
    muscle_group: 'forearms',
    measure_type: 'reps',
    instructions_es: 'De pie con la barra agarrada, eleva los hombros verticalmente hacia las orejas sin rotar.',
    instructions_en: 'Stand tall holding barbell, shrug shoulders vertically toward ears without rolling them.'
  },
  {
    external_id: 'fb-030',
    name: 'Plancha Abdominal Isométrica (Plank)',
    body_part: 'waist',
    category: 'bodyweight',
    equipment: 'bodyweight',
    target: 'abs',
    muscle_group: 'core, glutes, shoulders',
    measure_type: 'time',
    instructions_es: 'Apóyate sobre los antebrazos y las puntas de los pies. Mantén el cuerpo en línea recta y aprieta el abdomen sin dejar caer la cadera.',
    instructions_en: 'Support body on forearms and toes. Maintain strict straight line from head to heels, bracing core firmly.'
  }
];

function fetchJson(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 7000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        return fetchJson(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function seedExercises() {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM exercises WHERE is_global = 1').get();
  if (existingCount && existingCount.count > 0) {
    console.log(`[Seed] Hay ${existingCount.count} ejercicios globales ya existentes. Omitiendo descarga.`);
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO exercises (
      external_id, name, body_part, category, equipment, target,
      muscle_group, measure_type, is_global, user_id, gif_url, image_url,
      instructions_es, instructions_en
    ) VALUES (
      @external_id, @name, @body_part, @category, @equipment, @target,
      @muscle_group, @measure_type, @is_global, @user_id, @gif_url, @image_url,
      @instructions_es, @instructions_en
    )
  `);

  const insertMany = db.transaction((exercises) => {
    for (const ex of exercises) {
      insertStmt.run(ex);
    }
  });

  console.log('[Seed] Intentando descargar dataset de ejercicios desde GitHub...');
  const datasetUrl = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';

  try {
    const dataset = await fetchJson(datasetUrl);
    if (!Array.isArray(dataset) || dataset.length === 0) {
      throw new Error('El dataset descargado no es un array válido o está vacío.');
    }

    console.log(`[Seed] Dataset descargado con éxito (${dataset.length} elementos). Filtrando ejercicios de fuerza...`);

    const filtered = dataset.filter(item => {
      const bp = (item.bodyPart || item.body_part || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const target = (item.target || '').toLowerCase();
      // Excluir cardio puro
      if (bp === 'cardio' || cat === 'cardio' || target.includes('cardiovascular')) {
        return false;
      }
      return true;
    });

    const mapped = filtered.map(item => {
      const extId = item.id || item.external_id || null;
      const rawGif = item.gifUrl || item.gif_url || '';
      const gifFilename = rawGif ? rawGif.split('/').pop() : '';
      const gifUrl = gifFilename
        ? `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/${gifFilename}`
        : null;
      const imageUrl = gifFilename
        ? `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/images/${gifFilename.replace(/\.gif$/, '.jpg')}`
        : null;

      const muscleGroup = Array.isArray(item.secondaryMuscles)
        ? item.secondaryMuscles.join(', ')
        : (Array.isArray(item.muscleGroup) ? item.muscleGroup.join(', ') : (item.muscleGroup || item.secondaryMuscles || ''));

      let instructionsEs = '';
      let instructionsEn = '';

      if (item.instructions) {
        if (typeof item.instructions === 'object' && !Array.isArray(item.instructions)) {
          if (item.instructions.es) {
            instructionsEs = Array.isArray(item.instructions.es) ? item.instructions.es.join('\n') : String(item.instructions.es);
          }
          if (item.instructions.en) {
            instructionsEn = Array.isArray(item.instructions.en) ? item.instructions.en.join('\n') : String(item.instructions.en);
          }
        } else if (Array.isArray(item.instructions)) {
          instructionsEn = item.instructions.join('\n');
        } else if (typeof item.instructions === 'string') {
          instructionsEn = item.instructions;
        }
      }

      const nameLower = (item.name || '').toLowerCase();
      const isTimeBased = nameLower.includes('plank') || nameLower.includes('hold') || nameLower.includes('isométr');

      return {
        external_id: extId ? String(extId) : null,
        name: item.name || 'Ejercicio sin nombre',
        body_part: item.bodyPart || item.body_part || 'general',
        category: item.category || 'strength',
        equipment: item.equipment || 'bodyweight',
        target: item.target || 'general',
        muscle_group: muscleGroup || null,
        measure_type: isTimeBased ? 'time' : 'reps',
        is_global: 1,
        user_id: null,
        gif_url: gifUrl,
        image_url: imageUrl,
        instructions_es: instructionsEs || null,
        instructions_en: instructionsEn || null
      };
    });

    insertMany(mapped);
    console.log(`[Seed] ${mapped.length} ejercicios de fuerza insertados desde el dataset externo.`);
  } catch (err) {
    console.warn(`[Seed] Aviso: No se pudo descargar el dataset externo (${err.message}). Insertando los 30 ejercicios base de fuerza...`);
    const fallbackMapped = FALLBACK_EXERCISES.map(f => ({
      ...f,
      is_global: 1,
      user_id: null,
      gif_url: null,
      image_url: null
    }));
    insertMany(fallbackMapped);
    console.log(`[Seed] ${fallbackMapped.length} ejercicios base insertados con éxito.`);
  }
}

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@bilboag.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234!';
  const adminUsername = 'admin';

  const existingAdmin = db.prepare("SELECT id, email, username FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existingAdmin) {
    console.log(`[Seed] Usuario admin existente encontrado (${existingAdmin.username} <${existingAdmin.email}>).`);
    return;
  }

  const existingByEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (existingByEmail) {
    db.prepare("UPDATE users SET role = 'admin', is_approved = 1 WHERE id = ?").run(existingByEmail.id);
    console.log(`[Seed] Usuario con email ${adminEmail} promovido a admin.`);
    return;
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  db.prepare(`
    INSERT INTO users (username, email, password_hash, role, is_approved, created_at)
    VALUES (?, ?, ?, 'admin', 1, datetime('now'))
  `).run(adminUsername, adminEmail, passwordHash);

  console.log(`[Seed] Administrador inicial creado con éxito: ${adminEmail} (user: ${adminUsername})`);
}

async function seedDatabase() {
  await seedExercises();
  await seedAdminUser();
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Proceso de seed completado.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error durante el proceso de seed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
