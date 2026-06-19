import React, { Component } from 'react';
import axios from 'axios';

class Fib extends Component {
  state = {
    seenIndexes: [],
    values: {},
    index: '',
    submitting: false,
  };

  componentDidMount() {
    this.fetchData();
    this.interval = setInterval(this.fetchValues, 2000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  fetchData = () => {
    this.fetchValues();
    this.fetchIndexes();
  };

  async fetchValues() {
    const values = await axios.get('/api/values/current');
    this.setState({ values: values.data || {} });
  }

  async fetchIndexes() {
    const seenIndexes = await axios.get('/api/values/all');
    this.setState({ seenIndexes: seenIndexes.data || [] });
  }

  handleSubmit = async (event) => {
    event.preventDefault();
    if (!this.state.index) return;

    this.setState({ submitting: true });
    await axios.post('/api/values', { index: this.state.index });
    this.setState({ index: '', submitting: false });
    this.fetchData();
  };

  renderSeenIndexes() {
    if (!this.state.seenIndexes.length) {
      return <span className="chip-empty">No indexes yet — submit one above</span>;
    }

    return this.state.seenIndexes.map(({ number }) => (
      <span key={number} className="chip">{number}</span>
    ));
  }

  renderValues() {
    const entries = Object.entries(this.state.values || {});

    if (!entries.length) {
      return <span className="chip-empty">Waiting for worker to calculate…</span>;
    }

    return entries.map(([key, val]) => (
      <div key={key} className="value-row">
        <span>Index {key}</span>
        <span>{val}</span>
      </div>
    ));
  }

  render() {
    return (
      <div className="page-card">
        <div className="page-header">
          <h1>Fibonacci Calculator</h1>
          <p>
            Submit an index — the API stores it in Postgres, the worker computes
            the result via Redis, and values appear below in real time.
          </p>
        </div>

        <form className="fib-form" onSubmit={this.handleSubmit}>
          <div className="fib-input-wrap">
            <label htmlFor="fib-index">Enter index (max 40)</label>
            <input
              id="fib-index"
              className="fib-input"
              type="number"
              min="0"
              max="40"
              placeholder="e.g. 10"
              value={this.state.index}
              onChange={(event) => this.setState({ index: event.target.value })}
            />
          </div>
          <button className="fib-submit" type="submit" disabled={this.state.submitting}>
            {this.state.submitting ? 'Submitting…' : 'Calculate'}
          </button>
        </form>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Seen indexes</h3>
            <div className="chip-list">{this.renderSeenIndexes()}</div>
          </div>
          <div className="stat-card">
            <h3>Calculated values</h3>
            <div className="value-list">{this.renderValues()}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default Fib;
