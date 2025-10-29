import express from "express";
import { z } from "zod";
import { supabase } from "./database.js";
import { authenticationtoken } from "./authmiddleware.js";
import { encryptText, decryptText, generateShareId } from "./encryption.js";

const router = express.Router();

// Validation schemas
const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_encrypted: z.boolean().optional(),
  is_public: z.boolean().optional(),
  is_draft: z.boolean().optional()
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_encrypted: z.boolean().optional(),
  is_public: z.boolean().optional(),
  is_draft: z.boolean().optional()
});

// Get all notes for authenticated user
router.get("/", authenticationtoken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, tag, draft_only } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("notes")
      .select("id, title, content, encrypted_content, is_encrypted, is_draft, is_public, tags, created_at, updated_at, published_at, auto_saved_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });

    // Filter by draft status
    if (draft_only === 'true') {
      query = query.eq("is_draft", true);
    } else if (draft_only === 'false') {
      query = query.eq("is_draft", false);
    }

    // Search functionality
    if (search) {
      query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
    }

    // Filter by tag
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: notes, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Decrypt encrypted notes
    const processedNotes = notes.map(note => {
      if (note.is_encrypted && note.encrypted_content) {
        try {
          note.content = decryptText(note.encrypted_content);
          delete note.encrypted_content; // Don't send encrypted content to client
        } catch (decryptError) {
          console.error("Decryption error for note:", note.id);
          note.content = "[Decryption Error]";
        }
      }
      return note;
    });

    res.json({
      notes: processedNotes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notes.length
      }
    });
  } catch (err) {
    console.error("Get notes error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single note by ID
router.get("/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: note, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !note) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Decrypt if encrypted
    if (note.is_encrypted && note.encrypted_content) {
      try {
        note.content = decryptText(note.encrypted_content);
        delete note.encrypted_content;
      } catch (decryptError) {
        console.error("Decryption error for note:", note.id);
        note.content = "[Decryption Error]";
      }
    }

    res.json({ note });
  } catch (err) {
    console.error("Get note error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new note
router.post("/", authenticationtoken, async (req, res) => {
  try {
    const validatedData = createNoteSchema.parse(req.body);
    const { title, content = "", tags = [], is_encrypted = false, is_public = false, is_draft = true } = validatedData;

    let noteData = {
      user_id: req.user.id,
      title,
      tags,
      is_encrypted,
      is_public,
      is_draft,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Handle encryption
    if (is_encrypted && content) {
      noteData.encrypted_content = encryptText(content);
      noteData.content = null; // Don't store plain text if encrypted
    } else {
      noteData.content = content;
    }

    // Generate public share ID if public
    if (is_public) {
      noteData.public_share_id = generateShareId();
      noteData.published_at = new Date().toISOString();
    }

    // Set published_at if not draft
    if (!is_draft) {
      noteData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("notes")
      .insert([noteData])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Return decrypted content for response
    if (data.is_encrypted && data.encrypted_content) {
      data.content = content; // We already have the original content
      delete data.encrypted_content;
    }

    res.status(201).json({ 
      message: "Note created successfully", 
      note: data 
    });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Create note error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update note
router.put("/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateNoteSchema.parse(req.body);

    // Check if note exists and belongs to user
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError || !existingNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    let updateData = {
      ...validatedData,
      updated_at: new Date().toISOString()
    };

    // Handle encryption changes
    if (validatedData.hasOwnProperty('content')) {
      const shouldEncrypt = validatedData.is_encrypted ?? existingNote.is_encrypted;
      
      if (shouldEncrypt && validatedData.content) {
        updateData.encrypted_content = encryptText(validatedData.content);
        updateData.content = null;
      } else {
        updateData.content = validatedData.content;
        updateData.encrypted_content = null;
      }
    }

    // Handle public sharing
    if (validatedData.is_public === true && !existingNote.public_share_id) {
      updateData.public_share_id = generateShareId();
    } else if (validatedData.is_public === false) {
      updateData.public_share_id = null;
    }

    // Handle draft status
    if (validatedData.is_draft === false && existingNote.is_draft === true) {
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("notes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Return decrypted content for response
    if (data.is_encrypted && data.encrypted_content) {
      try {
        data.content = decryptText(data.encrypted_content);
        delete data.encrypted_content;
      } catch (decryptError) {
        data.content = "[Decryption Error]";
      }
    }

    res.json({ 
      message: "Note updated successfully", 
      note: data 
    });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Update note error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auto-save note (for drafts)
router.patch("/:id/autosave", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, title } = req.body;

    // Check if note exists and belongs to user
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("is_encrypted")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError || !existingNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    let updateData = {
      auto_saved_at: new Date().toISOString()
    };

    if (title !== undefined) {
      updateData.title = title;
    }

    if (content !== undefined) {
      if (existingNote.is_encrypted) {
        updateData.encrypted_content = encryptText(content);
        updateData.content = null;
      } else {
        updateData.content = content;
      }
    }

    const { error } = await supabase
      .from("notes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      message: "Note auto-saved successfully",
      auto_saved_at: updateData.auto_saved_at
    });
  } catch (err) {
    console.error("Auto-save error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete note
router.delete("/:id", authenticationtoken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error("Delete note error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get public note by share ID (no authentication required)
router.get("/public/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params;

    const { data: note, error } = await supabase
      .from("notes")
      .select("id, title, content, encrypted_content, is_encrypted, tags, created_at, updated_at, published_at")
      .eq("public_share_id", shareId)
      .eq("is_public", true)
      .eq("is_draft", false)
      .single();

    if (error || !note) {
      return res.status(404).json({ error: "Public note not found" });
    }

    // Decrypt if encrypted (for public notes, we still decrypt server-side)
    if (note.is_encrypted && note.encrypted_content) {
      try {
        note.content = decryptText(note.encrypted_content);
        delete note.encrypted_content;
      } catch (decryptError) {
        console.error("Decryption error for public note:", note.id);
        note.content = "[Content unavailable]";
      }
    }

    res.json({ note });
  } catch (err) {
    console.error("Get public note error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get note statistics
router.get("/stats/overview", authenticationtoken, async (req, res) => {
  try {
    const { data: stats, error } = await supabase
      .from("notes")
      .select("is_draft, is_public, is_encrypted")
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const overview = {
      total: stats.length,
      drafts: stats.filter(note => note.is_draft).length,
      published: stats.filter(note => !note.is_draft).length,
      public: stats.filter(note => note.is_public).length,
      encrypted: stats.filter(note => note.is_encrypted).length
    };

    res.json({ stats: overview });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test route to check if notes API is working
router.get("/test", authenticationtoken, async (req, res) => {
  try {
    res.json({ 
      message: "Notes API is working!", 
      user: req.user,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Test route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;