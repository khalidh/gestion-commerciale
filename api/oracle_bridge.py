import os
import json


class OracleBridge:
    """Bridge conceptuel pour lire des données Oracle via un script externe ou un client futur."""

    def __init__(self, config_path=None):
        self.config_path = config_path or os.path.join(os.path.dirname(__file__), '..', 'oracle', 'connection_config.env')

    def load_config(self):
        config = {}
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r', encoding='utf-8') as handle:
                for line in handle:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    key, value = line.split('=', 1)
                    config[key.strip()] = value.strip()
        return config

    def get_customer_payload(self):
        config = self.load_config()
        return {
            "source": "oracle-config",
            "configured": bool(config.get('ORACLE_USER') and config.get('ORACLE_DSN')),
            "config": config,
            "message": "Bridge prêt pour une connexion Oracle réelle via cx_Oracle ou SQLcl"
        }

    def to_json(self):
        return json.dumps(self.get_customer_payload(), indent=2, ensure_ascii=False)


if __name__ == '__main__':
    bridge = OracleBridge()
    print(bridge.to_json())
