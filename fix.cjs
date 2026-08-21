const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = code.split('\n');

// The glitch is from line 6480 to 6519. We want to replace it.
const startIdx = 6480 - 1;
const endIdx = 6520 - 1;

const replacement = `                onClick={() => { setSidebarTab('contacts'); setIsMobileSidebarOpen(true); }} 
                className={cn(
                  "p-6 rounded-[32px] border border-white/10 hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 backdrop-blur-xl shadow-2xl",
                  themeName === 'liquidglass' ? 'liquid-glass-input' : 'bg-white/5 hover:bg-white/10'
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">Find Contacts</p>
              </div>
              
              <div 
                onClick={() => setIsAddConnectionModalOpen(true)} 
                className={cn(
                  "p-6 rounded-[32px] border border-white/10 hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 backdrop-blur-xl shadow-2xl",
                  themeName === 'liquidglass' ? 'liquid-glass-input' : 'bg-white/5 hover:bg-white/10'
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">Connect by ID</p>
              </div>
            </div>
          </div>
        )}
      </div>
      </motion.div>
`;

lines.splice(startIdx, endIdx - startIdx, replacement);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
