import { Router } from 'express';
import { db } from '../lib/db.js';
import { UpdateCharacterBibleSchema, UpdateStyleBibleSchema } from '../shared/validators/projectSchemas.js';

export const bibleRouter = Router({ mergeParams: true });

// GET /api/v1/projects/:id/bibles
bibleRouter.get('/', async (req, res, next) => {
  try {
    const projectId = (req.params as any).id;
    const [characterBibles, styleBible] = await Promise.all([
      db.getCharacterBibles(projectId),
      db.getStyleBible(projectId),
    ]);

    res.json({
      characterBibles,
      styleBible,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/projects/:id/bibles/character/:charId
bibleRouter.put('/character/:charId', async (req, res, next) => {
  try {
    const validated = UpdateCharacterBibleSchema.parse(req.body);
    const updated = await db.updateCharacterBible(req.params.charId, {
      name: validated.name,
      description: validated.description,
      visual_attributes: validated.visualAttributes,
      reference_image_url: validated.referenceImageUrl || null,
      voice_id: validated.voiceId || null,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/projects/:id/bibles/style
bibleRouter.put('/style', async (req, res, next) => {
  try {
    const validated = UpdateStyleBibleSchema.parse(req.body);
    const projectId = (req.params as any).id;

    const updated = await db.upsertStyleBible({
      project_id: projectId,
      style_name: validated.styleName,
      lighting: validated.lighting,
      camera_gear: validated.cameraGear,
      color_palette: validated.colorPalette,
      environment_rules: validated.environmentRules,
      negative_prompt: validated.negativePrompt,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
