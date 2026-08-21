const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = code.split('\n');

const replacement = `                    );
                  })()
                )}
              </div>
            </motion.div>
          )}
        </div>
      ) : (`;

const startIdx = 6451;
const endIdx = 6452;

lines.splice(startIdx, endIdx - startIdx + 1, replacement);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
