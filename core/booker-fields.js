/* Astranov Sites — progressive field presets by businessType + stage */
window.AstranovSitesFields = {
  stages: ['schedule', 'product', 'details', 'extras', 'contact', 'confirm'],
  presets: {
    yacht_charter: [
      { id: 'start_date', stage: 'schedule', type: 'date', label: 'From', required: true, modes: ['range'] },
      { id: 'end_date', stage: 'schedule', type: 'date', label: 'To', required: true, modes: ['range'] },
      { id: 'guests', stage: 'schedule', type: 'number', label: 'Guests', min: 1, default: 8, modes: ['range'] },
      { id: 'cabins', stage: 'schedule', type: 'number', label: 'Cabins', min: 1, default: 4, modes: ['range'] },
      { id: 'budget', stage: 'product', type: 'number', label: 'Budget (EUR)', min: 0, modes: ['range'] },
      { id: 'yacht_type', stage: 'product', type: 'select', label: 'Yacht type', options: ['Any', 'Motor Yacht', 'Sailing Yacht', 'Catamaran', 'Eco Yacht', 'Superyacht'], modes: ['range'] },
      { id: 'traits', stage: 'product', type: 'text', label: 'Characteristics', placeholder: 'eco, jacuzzi, crew', modes: ['range'] },
      { id: 'message', stage: 'details', type: 'textarea', label: 'Request details', required: true, placeholder: 'Departure area, style, crew, water toys...', modes: ['range'] }
    ],
    diving_school: [
      { id: 'date', stage: 'schedule', type: 'date', label: 'Date', required: true, modes: ['slot'] },
      { id: 'time', stage: 'schedule', type: 'select', label: 'Timeslot', required: true, dynamic: 'timeslots', modes: ['slot'] },
      { id: 'product', stage: 'product', type: 'select', label: 'Product / activity', required: true, dynamic: 'products', modes: ['slot'] },
      { id: 'divers_count', stage: 'details', type: 'number', label: 'Divers', min: 0, default: 0, modes: ['slot'] },
      { id: 'passengers_count', stage: 'details', type: 'number', label: 'Passengers', min: 0, default: 0, modes: ['slot'] },
      { id: 'kids_count', stage: 'details', type: 'number', label: 'Kids', min: 0, default: 0, modes: ['slot'] },
      { id: 'babies_count', stage: 'details', type: 'number', label: 'Babies', min: 0, default: 0, modes: ['slot'] },
      { id: 'certification', stage: 'details', type: 'text', label: 'Certification level', modes: ['slot'] },
      { id: 'dives', stage: 'details', type: 'number', label: 'Number of dives', min: 0, modes: ['slot'] },
      { id: 'employee', stage: 'extras', type: 'select', label: 'Preferred instructor', dynamic: 'employees', modes: ['slot'] },
      { id: 'referral', stage: 'extras', type: 'select', label: 'How did you find us?', dynamic: 'referrals', modes: ['slot'] },
      { id: 'comments', stage: 'extras', type: 'textarea', label: 'Comments', modes: ['slot'] },
      { id: 'agreement_ack', stage: 'confirm', type: 'select', label: 'Agreement acknowledgement', required: true, options: [
        { value: '', label: 'Open/download agreement before verification' },
        { value: 'I opened, downloaded and will bring the signed agreement', label: 'I opened, downloaded and will bring the signed agreement' }
      ], modes: ['slot'] }
    ],
    restaurant: [
      { id: 'date', stage: 'schedule', type: 'date', label: 'Date', required: true, modes: ['slot'] },
      { id: 'time', stage: 'schedule', type: 'select', label: 'Time', required: true, dynamic: 'timeslots', modes: ['slot'] },
      { id: 'party_size', stage: 'schedule', type: 'number', label: 'Party size', min: 1, required: true, modes: ['slot'] },
      { id: 'prep_time', stage: 'product', type: 'number', label: 'Prep lead time (min)', min: 0, modes: ['slot'] },
      { id: 'table_preference', stage: 'product', type: 'select', label: 'Seating', options: ['Any', 'Indoor', 'Terrace', 'Waterfront', 'Private'], modes: ['slot'] },
      { id: 'dietary', stage: 'details', type: 'textarea', label: 'Dietary notes', modes: ['slot'] },
      { id: 'menu_selection', stage: 'product', type: 'select', label: 'Menu / tasting', dynamic: 'products', modes: ['slot'] }
    ],
    hotel: [
      { id: 'check_in', stage: 'schedule', type: 'date', label: 'Check-in', required: true, modes: ['range'] },
      { id: 'check_out', stage: 'schedule', type: 'date', label: 'Check-out', required: true, modes: ['range'] },
      { id: 'rooms', stage: 'schedule', type: 'number', label: 'Rooms', min: 1, default: 1, modes: ['range'] },
      { id: 'guests', stage: 'schedule', type: 'number', label: 'Guests', min: 1, default: 2, modes: ['range'] },
      { id: 'room_type', stage: 'product', type: 'select', label: 'Room type', dynamic: 'products', modes: ['range'] },
      { id: 'breakfast', stage: 'extras', type: 'select', label: 'Breakfast', options: ['Not needed', 'Continental', 'Full board'], modes: ['range'] }
    ],
    rental_car: [
      { id: 'pickup_date', stage: 'schedule', type: 'date', label: 'Pickup date', required: true, modes: ['range'] },
      { id: 'return_date', stage: 'schedule', type: 'date', label: 'Return date', required: true, modes: ['range'] },
      { id: 'pickup_time', stage: 'schedule', type: 'select', label: 'Pickup time', dynamic: 'timeslots', modes: ['range', 'slot'] },
      { id: 'vehicle_class', stage: 'product', type: 'select', label: 'Vehicle class', dynamic: 'products', modes: ['range', 'slot'] },
      { id: 'drivers', stage: 'details', type: 'number', label: 'Drivers', min: 1, default: 1, modes: ['range', 'slot'] },
      { id: 'insurance', stage: 'extras', type: 'select', label: 'Insurance', options: ['Basic', 'Full', 'Premium'], modes: ['range', 'slot'] },
      { id: 'child_seat', stage: 'extras', type: 'number', label: 'Child seats', min: 0, modes: ['range', 'slot'] }
    ],
    generic: [
      { id: 'date', stage: 'schedule', type: 'date', label: 'Date', modes: ['slot'] },
      { id: 'start_date', stage: 'schedule', type: 'date', label: 'From', modes: ['range'] },
      { id: 'end_date', stage: 'schedule', type: 'date', label: 'To', modes: ['range'] },
      { id: 'product', stage: 'product', type: 'select', label: 'Service', dynamic: 'products', modes: ['slot', 'range'] },
      { id: 'quantity', stage: 'details', type: 'number', label: 'Quantity', min: 1, default: 1, modes: ['slot', 'range'] },
      { id: 'notes', stage: 'extras', type: 'textarea', label: 'Notes', modes: ['slot', 'range'] }
    ],
    contact: [
      { id: 'client_name', stage: 'contact', type: 'text', label: 'Full name', required: true, modes: ['slot', 'range'] },
      { id: 'client_phone', stage: 'contact', type: 'tel', label: 'Phone', required: true, modes: ['slot', 'range'] },
      { id: 'client_email', stage: 'contact', type: 'email', label: 'Email', required: true, modes: ['slot', 'range'] }
    ]
  },
  resolve(config) {
    const type = config.businessType || 'generic';
    const mode = config.mode || 'slot';
    const custom = Array.isArray(config.fields) ? config.fields : [];
    const matchCfg = window.AstranovMatchEngine?.resolveConfig?.(config);
    const activeIds = matchCfg?.demand_fields;
    let base = [...(this.presets[type] || this.presets.generic), ...this.presets.contact];
    if (activeIds?.length) {
      base = base.filter((f) => activeIds.includes(f.id) || f.stage === 'contact');
    }
    const merged = custom.length ? [...base.filter(f => !custom.some(c => c.id === f.id)), ...custom] : base;
    return merged.filter(f => !f.modes || f.modes.includes(mode));
  },

  fieldRequestLabel(config, fieldId) {
    return {
      id: fieldId,
      type: 'text',
      label: fieldId.replace(/_/g, ' '),
      stage: 'details',
      _requested: true,
    };
  }
};
window.SuperBookingFields = window.AstranovSitesFields;