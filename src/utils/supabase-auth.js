const supabase = require('../database/supabase');
const { proto, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

const useSupabaseAuthState = async (sessionId) => {
    const writeData = async (data, id) => {
        try {
            // Use BufferJSON to handle Buffers and BigInts correctly
            const serializedData = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            
            const { error } = await supabase
                .from('baileys_auth')
                .upsert({ 
                    id: `${sessionId}-${id}`, 
                    data: serializedData 
                });
            if (error) throw error;
        } catch (err) {
            console.error(`[Auth Write Error] ${id}:`, err.message);
        }
    };

    const readData = async (id) => {
        try {
            const { data, error } = await supabase
                .from('baileys_auth')
                .select('data')
                .eq('id', `${sessionId}-${id}`)
                .maybeSingle();

            if (error) throw error;
            
            // Restore data using BufferJSON.reviver
            return data ? JSON.parse(JSON.stringify(data.data), BufferJSON.reviver) : null;
        } catch (err) {
            console.error(`[Auth Read Error] ${id}:`, err.message);
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            const { error } = await supabase
                .from('baileys_auth')
                .delete()
                .eq('id', `${sessionId}-${id}`);
            if (error) throw error;
        } catch (err) {
            console.error(`[Auth Delete Error] ${id}:`, err.message);
        }
    };

    // Load initial credentials
    const credsData = await readData('creds');
    const creds = credsData || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const sId = `${category}-${id}`;
                            if (value) tasks.push(writeData(value, sId));
                            else tasks.push(removeData(sId));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
};

module.exports = { useSupabaseAuthState };
