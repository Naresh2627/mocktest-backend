import express from "express";
import { z } from "zod";
import { supabase } from "./database.js";
import { authenticationtoken } from "./authmiddleware.js";

const router = express.Router();

// Validation schemas
const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().max(50).optional(),
  description: z.string().optional()
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().max(50).optional(),
  description: z.string().optional(),
  parent_category_id: z.number().optional()
});

const updateLabelSchema = createLabelSchema.partial();
const updateCategorySchema = createCategorySchema.partial();

// LABELS ROUTES

// Get all labels for authenticated user
router.get("/labels", authenticationtoken, async (req, res) => {
  try {
    const { data: labels, error } = await supabase
      .from("labels")
      .select("*")
      .eq("user_id", req.user.id)
      .order("name");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ labels });
  } catch (err) {
    console.error("Get labels error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new label
router.post("/labels", authenticationtoken, async (req, res) => {
  try {
    const validatedData = createLabelSchema.parse(req.body);
    
    const labelData = {
      user_id: req.user.id,
      name: validatedData.name,
      color: validatedData.color || '#667eea',
      icon: validatedData.icon || '🏷️',
      description: validatedData.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("labels")
      .insert([labelData])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: "Label name already exists" });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: "Label created successfully", label: data });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Create label error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update label
router.put("/labels/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateLabelSchema.parse(req.body);

    const updateData = {
      ...validatedData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("labels")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Label name already exists" });
      }
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Label not found" });
    }

    res.json({ message: "Label updated successfully", label: data });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Update label error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete label
router.delete("/labels/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("labels")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: "Label not found" });
    }

    res.json({ message: "Label deleted successfully" });
  } catch (err) {
    console.error("Delete label error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// CATEGORIES ROUTES

// Get all categories for authenticated user
router.get("/categories", authenticationtoken, async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", req.user.id)
      .order("name");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ categories });
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new category
router.post("/categories", authenticationtoken, async (req, res) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);
    
    const categoryData = {
      user_id: req.user.id,
      name: validatedData.name,
      color: validatedData.color || '#28a745',
      icon: validatedData.icon || '📁',
      description: validatedData.description || null,
      parent_category_id: validatedData.parent_category_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("categories")
      .insert([categoryData])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Category name already exists" });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: "Category created successfully", category: data });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Create category error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update category
router.put("/categories/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateCategorySchema.parse(req.body);

    const updateData = {
      ...validatedData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Category name already exists" });
      }
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category updated successfully", category: data });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Update category error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete category
router.delete("/categories/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ASSIGNMENT ROUTES

// Assign labels to note
router.post("/notes/:noteId/labels", authenticationtoken, async (req, res) => {
  try {
    const { noteId } = req.params;
    const { labelIds } = req.body;

    if (!Array.isArray(labelIds)) {
      return res.status(400).json({ error: "labelIds must be an array" });
    }

    // Verify note belongs to user
    const { data: note } = await supabase
      .from("notes")
      .select("id")
      .eq("id", noteId)
      .eq("user_id", req.user.id)
      .single();

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Remove existing labels
    await supabase
      .from("note_labels")
      .delete()
      .eq("note_id", noteId);

    // Add new labels
    if (labelIds.length > 0) {
      const assignments = labelIds.map(labelId => ({
        note_id: parseInt(noteId),
        label_id: labelId,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("note_labels")
        .insert(assignments);

      if (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    res.json({ message: "Labels assigned successfully" });
  } catch (err) {
    console.error("Assign labels error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign categories to note
router.post("/notes/:noteId/categories", authenticationtoken, async (req, res) => {
  try {
    const { noteId } = req.params;
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ error: "categoryIds must be an array" });
    }

    // Verify note belongs to user
    const { data: note } = await supabase
      .from("notes")
      .select("id")
      .eq("id", noteId)
      .eq("user_id", req.user.id)
      .single();

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Remove existing categories
    await supabase
      .from("note_categories")
      .delete()
      .eq("note_id", noteId);

    // Add new categories
    if (categoryIds.length > 0) {
      const assignments = categoryIds.map(categoryId => ({
        note_id: parseInt(noteId),
        category_id: categoryId,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("note_categories")
        .insert(assignments);

      if (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    res.json({ message: "Categories assigned successfully" });
  } catch (err) {
    console.error("Assign categories error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get notes with their labels and categories
router.get("/notes-with-labels", authenticationtoken, async (req, res) => {
  try {
    const { label_id, category_id, search } = req.query;

    let query = `
      SELECT 
        n.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', l.id,
              'name', l.name,
              'color', l.color,
              'icon', l.icon
            )
          ) FILTER (WHERE l.id IS NOT NULL), 
          '[]'
        ) as labels,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'color', c.color,
              'icon', c.icon
            )
          ) FILTER (WHERE c.id IS NOT NULL), 
          '[]'
        ) as categories
      FROM notes n
      LEFT JOIN note_labels nl ON n.id = nl.note_id
      LEFT JOIN labels l ON nl.label_id = l.id
      LEFT JOIN note_categories nc ON n.id = nc.note_id
      LEFT JOIN categories c ON nc.category_id = c.id
      WHERE n.user_id = $1
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (label_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM note_labels nl2 
        WHERE nl2.note_id = n.id AND nl2.label_id = $${paramIndex}
      )`;
      params.push(label_id);
      paramIndex++;
    }

    if (category_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM note_categories nc2 
        WHERE nc2.note_id = n.id AND nc2.category_id = $${paramIndex}
      )`;
      params.push(category_id);
      paramIndex++;
    }

    if (search) {
      query += ` AND (n.title ILIKE $${paramIndex} OR n.content ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY n.id ORDER BY n.updated_at DESC`;

    const { data: notes, error } = await supabase.rpc('execute_sql', {
      sql_query: query,
      params: params
    });

    if (error) {
      // Fallback to simpler query if RPC doesn't work
      const { data: simpleNotes, error: simpleError } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", req.user.id)
        .order("updated_at", { ascending: false });

      if (simpleError) {
        return res.status(400).json({ error: simpleError.message });
      }

      return res.json({ notes: simpleNotes });
    }

    res.json({ notes });
  } catch (err) {
    console.error("Get notes with labels error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;