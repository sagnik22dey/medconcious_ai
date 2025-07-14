import supabase
import os
from dotenv import load_dotenv, find_dotenv
# Load environment variables from .env file

_ = load_dotenv(find_dotenv())

class SupabaseHandler:
    def __init__(self):
        self.url = os.getenv('SUPABASE_URL')
        self.key = os.getenv('SUPABASE_KEY')
        self.client = supabase.create_client(self.url, self.key)
    
    def insert_patient_info(self, patient_data):
        """
        Insert patient information into patient_info table
        
        Args:
            patient_data (dict): Dictionary containing patient information
            
        Returns:
            dict: Response from Supabase
        """
        try:
            response = self.client.table('patient_info').insert(patient_data).execute()
            return response
        except Exception as e:
            print(f"Error inserting patient data: {e}")
            return None
    
    def conversation_history(self, conversation_history):
        """
        Insert conversation history for a specific patient
        Args:
            id (str): Unique identifier for the conversation
        Returns:
            dict: Response from Supabase
        """
        try:
            response = self.client.table('conversation_history').insert(conversation_history).execute()
            return response
        except Exception as e:
            print(f"Error fetching conversation history: {e}")
            return None
        
    def store_user_info(self, user_data):
        """
        Insert user information into user_info table
        
        Args:
            user_data (dict): Dictionary containing user information
            
        Returns:
            dict: Response from Supabase
        """
        try:
            response = self.client.table('user_info').insert(user_data).execute()
            return response
        except Exception as e:
            print(f"Error inserting user data: {e}")
            return None
    def get_user_info(self, user_id):
        """
        Fetch user information by user ID
        
        Args:
            user_id (str): Unique identifier for the user
            
        Returns:
            dict: User information if found, else None
        """
        try:
            response = self.client.table('user_info').select('*').eq('id', user_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error fetching user info: {e}")
            return None
