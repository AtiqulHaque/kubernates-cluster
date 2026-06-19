import React, { Component } from 'react';
import axios from 'axios';

const API = '/api/nest/notes';

class Notes extends Component {
  state = {
    notes: [],
    loading: true,
    error: null,
    title: '',
    content: '',
    editingId: null,
    editTitle: '',
    editContent: '',
    saving: false,
  };

  componentDidMount() {
    this.fetchNotes();
  }

  fetchNotes = async () => {
    try {
      const { data } = await axios.get(API);
      this.setState({ notes: data, loading: false, error: null });
    } catch (err) {
      this.setState({ error: 'Failed to load notes', loading: false });
    }
  };

  handleCreate = async (e) => {
    e.preventDefault();
    const { title, content } = this.state;
    if (!title.trim() || !content.trim()) return;

    this.setState({ saving: true });
    try {
      await axios.post(API, { title, content });
      this.setState({ title: '', content: '', saving: false });
      this.fetchNotes();
    } catch (err) {
      this.setState({ error: 'Failed to create note', saving: false });
    }
  };

  startEdit = (note) => {
    this.setState({
      editingId: note.id,
      editTitle: note.title,
      editContent: note.content,
    });
  };

  cancelEdit = () => {
    this.setState({ editingId: null, editTitle: '', editContent: '' });
  };

  handleUpdate = async (id) => {
    const { editTitle, editContent } = this.state;
    if (!editTitle.trim() || !editContent.trim()) return;

    this.setState({ saving: true });
    try {
      await axios.put(`${API}/${id}`, {
        title: editTitle,
        content: editContent,
      });
      this.setState({ editingId: null, saving: false });
      this.fetchNotes();
    } catch (err) {
      this.setState({ error: 'Failed to update note', saving: false });
    }
  };

  handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await axios.delete(`${API}/${id}`);
      this.fetchNotes();
    } catch (err) {
      this.setState({ error: 'Failed to delete note' });
    }
  };

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleString();
  }

  render() {
    const {
      notes,
      loading,
      error,
      title,
      content,
      editingId,
      editTitle,
      editContent,
      saving,
    } = this.state;

    if (loading) {
      return (
        <div className="page-card">
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading notes…</span>
          </div>
        </div>
      );
    }

    return (
      <div className="page-card">
        <div className="page-header">
          <h1>
            Notes
            <span className="badge">CRUD</span>
          </h1>
          <p>
            Full create, read, update, and delete via the NestJS API at{' '}
            <code>/api/nest/notes</code>.
          </p>
        </div>

        {error && <div className="error-state">{error}</div>}

        <form className="note-form" onSubmit={this.handleCreate}>
          <h3 className="section-label">Add new note</h3>
          <div className="note-form-grid">
            <div className="fib-input-wrap">
              <label htmlFor="note-title">Title</label>
              <input
                id="note-title"
                className="fib-input"
                placeholder="Note title"
                value={title}
                onChange={(e) => this.setState({ title: e.target.value })}
              />
            </div>
            <div className="fib-input-wrap note-content-wrap">
              <label htmlFor="note-content">Content</label>
              <textarea
                id="note-content"
                className="fib-input note-textarea"
                placeholder="Write your note…"
                rows={3}
                value={content}
                onChange={(e) => this.setState({ content: e.target.value })}
              />
            </div>
          </div>
          <button className="fib-submit" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add Note'}
          </button>
        </form>

        <h3 className="section-label">All notes ({notes.length})</h3>

        {!notes.length ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>No notes yet. Create one above.</p>
          </div>
        ) : (
          <div className="note-list">
            {notes.map((note) => (
              <div key={note.id} className="note-item">
                {editingId === note.id ? (
                  <div className="note-edit">
                    <input
                      className="fib-input"
                      value={editTitle}
                      onChange={(e) => this.setState({ editTitle: e.target.value })}
                    />
                    <textarea
                      className="fib-input note-textarea"
                      rows={3}
                      value={editContent}
                      onChange={(e) => this.setState({ editContent: e.target.value })}
                    />
                    <div className="note-actions">
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => this.handleUpdate(note.id)}
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button className="btn-sm btn-ghost" onClick={this.cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-item-header">
                      <strong className="note-title">{note.title}</strong>
                      <span className="note-date">{this.formatDate(note.updatedAt)}</span>
                    </div>
                    <p className="note-body">{note.content}</p>
                    <div className="note-actions">
                      <button className="btn-sm btn-ghost" onClick={() => this.startEdit(note)}>
                        Edit
                      </button>
                      <button className="btn-sm btn-danger" onClick={() => this.handleDelete(note.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

export default Notes;
