module.exports = {
  users: {
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string'
        },
        tags: {
          $ref: 'tags'
        }
      }
    }
  },
  tags: {
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string'
        }
      }
    }
  },
};
