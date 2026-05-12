export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  created_at: string
}

export interface Model {
  id: string
  owner_id: string
  name: string
  description: string | null
  file_path: string
  file_size: number
  original_format: 'glb' | 'gltf' | 'fbx' | 'zip'
  triangle_count: number
  thumbnail_path: string | null
  view_count: number
  is_public: boolean
  tags: string[]
  created_at: string
  updated_at: string
  // Joined via select('*, profiles(...)')
  profiles?: Pick<Profile, 'username' | 'avatar_url'> | null
}

export type SortOption = 'newest' | 'most_viewed'
