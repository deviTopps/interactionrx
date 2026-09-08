import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile, requirePermission } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);
router.use(loadProfile);

function isHerbLikeMedicine(medicine) {
  const description = medicine.description || '';
  const composition = medicine.composition || '';
  return (
    medicine.origin === 'Online' &&
    (description.includes('Imported from') ||
      description.includes('Discovered from') ||
      composition.includes('Composition to be verified'))
  );
}

router.get('/', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const [{ data, error }, { data: catalogHerbs }] = await Promise.all([
      supabase
        .from('herbal_medicines')
        .select(`*, medicine_ingredients (*)`)
        .order('created_at', { ascending: false }),
      supabase.from('canonical_herbs').select('canonical_name'),
    ]);

    if (error) throw error;

    const herbNames = new Set(
      (catalogHerbs || []).map((herb) => herb.canonical_name.toLowerCase())
    );

    const medicines = (data || []).filter((medicine) => {
      if (isHerbLikeMedicine(medicine)) return false;
      if (herbNames.has(medicine.name.toLowerCase())) return false;
      return true;
    });

    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('herbal_medicines')
      .select(`*, medicine_ingredients (*)`)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Medicine not found' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('write'), async (req, res) => {
  try {
    const {
      name,
      description,
      description_file_url,
      description_file_name,
      composition,
      composition_file_url,
      composition_file_name,
      origin,
      ingredients,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Medication name is required' });
    }

    const hasDescription = Boolean(description?.trim() || description_file_url?.trim());
    const hasComposition = Boolean(composition?.trim() || composition_file_url?.trim());

    if (!hasDescription) {
      return res.status(400).json({ error: 'Description is required (text or document)' });
    }

    if (!hasComposition) {
      return res.status(400).json({ error: 'Composition is required (text or document)' });
    }

    const supabase = createUserClient(req.accessToken);

    const { data: medicine, error: medicineError } = await supabase
      .from('herbal_medicines')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        description_file_url: description_file_url?.trim() || null,
        description_file_name: description_file_name?.trim() || null,
        composition: composition?.trim() || composition_file_name?.trim() || 'Document attached',
        composition_file_url: composition_file_url?.trim() || null,
        composition_file_name: composition_file_name?.trim() || null,
        origin: origin?.trim() || 'Local',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (medicineError) throw medicineError;

    if (ingredients?.length > 0) {
      const ingredientRows = ingredients
        .filter((i) => i.ingredient_name?.trim())
        .map((i) => ({
          medicine_id: medicine.id,
          ingredient_name: i.ingredient_name.trim(),
          quantity: i.quantity?.trim() || null,
          unit: i.unit?.trim() || null,
          notes: i.notes?.trim() || null,
        }));

      if (ingredientRows.length > 0) {
        const { error: ingredientsError } = await supabase
          .from('medicine_ingredients')
          .insert(ingredientRows);

        if (ingredientsError) throw ingredientsError;
      }
    }

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE',
      entityType: 'herbal_medicine',
      entityId: medicine.id,
      entityName: medicine.name,
      ipAddress: req.ip,
    });

    const { data: full, error: fetchError } = await supabase
      .from('herbal_medicines')
      .select(`*, medicine_ingredients (*)`)
      .eq('id', medicine.id)
      .single();

    if (fetchError) {
      return res.status(201).json({ ...medicine, medicine_ingredients: [] });
    }

    res.status(201).json(full);
  } catch (err) {
    console.error('POST /herbal-medicines error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('write'), async (req, res) => {
  try {
    const {
      name,
      description,
      description_file_url,
      description_file_name,
      composition,
      composition_file_url,
      composition_file_name,
      origin,
      ingredients,
    } = req.body;
    const supabase = createUserClient(req.accessToken);

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (description_file_url !== undefined) {
      updates.description_file_url = description_file_url?.trim() || null;
    }
    if (description_file_name !== undefined) {
      updates.description_file_name = description_file_name?.trim() || null;
    }
    if (composition !== undefined) updates.composition = composition?.trim() || null;
    if (composition_file_url !== undefined) {
      updates.composition_file_url = composition_file_url?.trim() || null;
    }
    if (composition_file_name !== undefined) {
      updates.composition_file_name = composition_file_name?.trim() || null;
    }
    if (origin !== undefined) updates.origin = origin?.trim() || 'Local';

    const { error: updateError } = await supabase
      .from('herbal_medicines')
      .update(updates)
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    if (ingredients !== undefined) {
      await supabase.from('medicine_ingredients').delete().eq('medicine_id', req.params.id);

      if (ingredients.length > 0) {
        const ingredientRows = ingredients
          .filter((i) => i.ingredient_name?.trim())
          .map((i) => ({
            medicine_id: req.params.id,
            ingredient_name: i.ingredient_name.trim(),
            quantity: i.quantity?.trim() || null,
            unit: i.unit?.trim() || null,
            notes: i.notes?.trim() || null,
          }));

        const { error: ingredientsError } = await supabase
          .from('medicine_ingredients')
          .insert(ingredientRows);

        if (ingredientsError) throw ingredientsError;
      }
    }

    const { data, error } = await supabase
      .from('herbal_medicines')
      .select(`*, medicine_ingredients (*)`)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE',
      entityType: 'herbal_medicine',
      entityId: req.params.id,
      entityName: data.name,
      ipAddress: req.ip,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('delete'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data: existing } = await supabase
      .from('herbal_medicines')
      .select('name')
      .eq('id', req.params.id)
      .single();

    const { error } = await supabase
      .from('herbal_medicines')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'DELETE',
      entityType: 'herbal_medicine',
      entityId: req.params.id,
      entityName: existing?.name,
      ipAddress: req.ip,
    });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
