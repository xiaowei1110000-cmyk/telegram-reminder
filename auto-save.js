/**
 * 自动保存到GitHub的JavaScript模块
 */
class GitHubAutoSave {
    constructor(username, repoName, token) {
        this.username = username;
        this.repoName = repoName;
        this.token = token;
        this.apiBase = 'https://api.github.com';
    }

    // 获取当前文件的SHA（用于更新）
    async getFileSha() {
        try {
            const response = await fetch(
                `${this.apiBase}/repos/${this.username}/${this.repoName}/contents/reminders.json`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.status === 404) {
                // 文件不存在，返回null表示需要创建
                return null;
            }

            if (!response.ok) {
                throw new Error(`获取文件失败: ${response.status}`);
            }

            const data = await response.json();
            return data.sha;
        } catch (error) {
            console.error('获取SHA失败:', error);
            throw error;
        }
    }

    // 保存数据到GitHub
    async saveToGitHub(jsonData, commitMessage = '更新提醒数据 [自动]') {
        try {
            // 获取当前文件的SHA
            const sha = await this.getFileSha();
            
            // 转换数据为base64
            const content = btoa(unescape(encodeURIComponent(jsonData)));
            
            const body = {
                message: commitMessage,
                content: content,
                ...(sha && { sha: sha }) // 如果有SHA就包含，否则表示创建新文件
            };

            const response = await fetch(
                `${this.apiBase}/repos/${this.username}/${this.repoName}/contents/reminders.json`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`保存失败: ${errorData.message || response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                commitHash: result.commit.sha,
                message: '✅ 已自动保存到GitHub'
            };
        } catch (error) {
            console.error('自动保存失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 测试连接
    async testConnection() {
        try {
            const response = await fetch(
                `${this.apiBase}/repos/${this.username}/${this.repoName}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    repo: data.full_name,
                    permissions: data.permissions
                };
            } else {
                return {
                    success: false,
                    error: `连接失败: ${response.status}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 导出供其他文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubAutoSave;
}
